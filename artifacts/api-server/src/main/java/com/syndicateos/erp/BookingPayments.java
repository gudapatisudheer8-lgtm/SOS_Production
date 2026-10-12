package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.core.ApiProblem;
import java.math.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Booking agreements and receipt history derived from actual, balanced account postings.
 * No legacy plot.advanceReceived backfill and no changes to issued financial records. */
final class BookingPayments {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    BookingPayments(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    private JsonNode data(Map<String,Object> row) {
        try { return json.readTree(row.get("data").toString()); }
        catch(Exception e) { throw new IllegalStateException("Invalid saved booking",e); }
    }
    private List<Map<String,Object>> rows(UUID project) {
        return jdbc.queryForList("""
            SELECT r.*,i.display_name AS recorder,coalesce(a.data->>'accountName','') AS account_name,
                coalesce(p.delta,0) AS cash_delta
            FROM sos.erp_records r JOIN sos.identities i ON i.id=r.created_by
            LEFT JOIN sos.erp_records a ON a.id=r.account_id
            LEFT JOIN LATERAL (
                SELECT sum(debit-credit) AS delta FROM sos.erp_postings
                WHERE record_id=r.id AND account_id IS NOT NULL
            ) p ON true
            WHERE r.project_id=? AND r.kind IN ('bookings','transactions') AND r.status<>'deleted'
            ORDER BY r.created_at,r.id
            """,project);
    }
    Map<String,Map<String,Object>> read(UUID project) {
        List<Map<String,Object>> rows=rows(project);
        Map<String,Map<String,Object>> indexed=new HashMap<>(),roots=new LinkedHashMap<>();
        Set<String> ambiguous=new HashSet<>();
        for(var r:rows) {
            indexed.put(r.get("id").toString(),r);
            if("bookings".equals(r.get("kind")) && "approved".equals(r.get("status"))
                && r.get("reversal_of")==null && !data(r).hasNonNull("_bookingRootId")
                && r.get("inventory_id")!=null) {
                String inventory=r.get("inventory_id").toString();
                if(roots.containsKey(inventory)) ambiguous.add(inventory);
                roots.put(inventory,r);
            }
        }
        Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(var root:roots.entrySet()) {
            // Unit bookings retain their own existing workflows.
            var inventory=jdbc.queryForList("SELECT kind FROM sos.erp_records WHERE id=? AND project_id=?",
                UUID.fromString(root.getKey()),project);
            if(inventory.isEmpty() || !"plots".equals(inventory.getFirst().get("kind"))) continue;
            var summary=summary(root.getValue(),rows,indexed);
            if(ambiguous.contains(root.getKey())) summary.put("reconciliationRequired",
                "Multiple active sale agreements exist for this plot. Reconcile them before collecting more money.");
            result.put(root.getKey(),summary);
        }
        return result;
    }
    Map<String,Object> active(UUID project,UUID inventory) { return read(project).get(inventory.toString()); }
    private boolean belongs(Map<String,Object> row,Set<String> aliases,Map<String,Map<String,Object>> index,Set<String> seen) {
        String id=row.get("id").toString();
        if(!seen.add(id)) return false;
        if(row.get("reversal_of")!=null) {
            var source=index.get(row.get("reversal_of").toString());
            return source!=null && belongs(source,aliases,index,seen);
        }
        if("bookings".equals(row.get("kind")))
            return aliases.contains(id) || aliases.contains(data(row).path("_bookingRootId").asText());
        var source=index.get(data(row).path("bookingId").asText());
        return source!=null && belongs(source,aliases,index,seen);
    }
    private Map<String,Object> summary(Map<String,Object> root,List<Map<String,Object>> rows,Map<String,Map<String,Object>> index) {
        JsonNode agreement=data(root);
        Set<String> aliases=new HashSet<>();
        Map<String,Object> parent=root;
        while(parent!=null && aliases.add(parent.get("id").toString()))
            parent=parent.get("correction_of")==null?null:index.get(parent.get("correction_of").toString());
        BigDecimal rate=agreement.path("ratePerSqYard").decimalValue(),total=agreement.path("totalValue").decimalValue();
        BigDecimal area=BigDecimal.ZERO;
        String reconciliation="";
        try {
            if(rate.signum()<=0 || total.signum()<=0) throw new ArithmeticException();
            area=agreement.hasNonNull("_lockedAreaSqYards")?agreement.path("_lockedAreaSqYards").decimalValue()
                :total.divide(rate,2,RoundingMode.UNNECESSARY);
            if(area.multiply(rate).compareTo(total)!=0) throw new ArithmeticException();
        } catch(ArithmeticException ex) { reconciliation="The original agreed sale price could not be verified. Reconcile this booking before collecting more money."; }
        BigDecimal running=BigDecimal.ZERO;
        List<Map<String,Object>> receipts=new ArrayList<>();
        for(var row:rows) {
            if(!belongs(row,aliases,index,new HashSet<>())) continue;
            JsonNode d=data(row);
            BigDecimal delta=(BigDecimal)row.get("cash_delta");
            BigDecimal before=running;
            running=running.add(delta);
            if(row.get("reversal_of")!=null) continue;
            if(delta.signum()<=0 && ((BigDecimal)row.get("amount")).signum()==0) continue;
            JsonNode saved=d.path("_paymentReceipt");
            var receipt=new LinkedHashMap<String,Object>();
            String state=switch(row.get("status").toString()) {
                case "approved"->delta.signum()>0?"recorded":"unposted";
                case "superseded"->"replaced"; case "referred_back"->"reversed"; default->"unposted";
            };
            BigDecimal receiptAmount=delta.signum()>0?delta:(BigDecimal)row.get("amount");
            receipt.put("id",row.get("id").toString());
            receipt.put("requestId",row.get("request_id").toString());
            receipt.put("receiptNumber","RCPT-"+row.get("id"));
            receipt.put("date",d.path("date").asText(row.get("created_at").toString().substring(0,10)));
            receipt.put("amount",receiptAmount.toPlainString());
            receipt.put("previousCollected",saved.has("previousCollected")?saved.get("previousCollected").asText():before.toPlainString());
            receipt.put("totalCollected",saved.has("totalCollected")?saved.get("totalCollected").asText():running.toPlainString());
            receipt.put("balanceAfter",saved.has("balanceAfter")?saved.get("balanceAfter").asText():total.subtract(running).toPlainString());
            JsonNode historical="bookings".equals(row.get("kind"))?d:
                index.containsKey(d.path("bookingId").asText())?data(index.get(d.path("bookingId").asText())):agreement;
            BigDecimal historicalRate=historical.path("ratePerSqYard").decimalValue();
            BigDecimal historicalTotal=historical.path("totalValue").decimalValue();
            BigDecimal historicalArea=historical.has("_lockedAreaSqYards")?historical.path("_lockedAreaSqYards").decimalValue():
                historicalRate.signum()>0?historicalTotal.divide(historicalRate,2,RoundingMode.HALF_UP):area;
            receipt.put("ratePerSqYard",saved.path("ratePerSqYard").asText(historicalRate.toPlainString()));
            receipt.put("totalValue",saved.path("totalValue").asText(historicalTotal.toPlainString()));
            receipt.put("areaSqYards",saved.path("areaSqYards").asText(historicalArea.toPlainString()));
            receipt.put("buyerName",saved.path("buyerName").asText(historical.path("buyerName").asText()));
            receipt.put("buyerPhone",saved.path("buyerPhone").asText(historical.path("buyerPhone").asText()));
            receipt.put("paymentMode",d.path("paymentMode").asText("Recorded payment"));
            receipt.put("paymentRefNumber",d.path("paymentRefNumber").asText(d.path("referenceNo").asText()));
            receipt.put("accountName",row.get("account_name")); receipt.put("recordedBy",row.get("recorder"));
            receipt.put("state",state); receipt.put("posted",delta.signum()>0);
            receipts.add(receipt);
        }
        if(running.signum()<0 || running.compareTo(total)>0)
            reconciliation="Existing posted collections do not match this sale agreement. Correct the records before collecting more money.";
        var result=new LinkedHashMap<String,Object>();
        result.put("inventoryId",root.get("inventory_id").toString()); result.put("bookingId",root.get("id").toString());
        result.put("locked",true); result.put("ratePerSqYard",rate.toPlainString());
        result.put("areaSqYards",area.toPlainString()); result.put("totalValue",total.toPlainString());
        result.put("collected",running.toPlainString()); result.put("balance",total.subtract(running).toPlainString());
        result.put("buyerName",agreement.path("buyerName").asText()); result.put("buyerPhone",agreement.path("buyerPhone").asText());
        result.put("receipts",receipts); result.put("reconciliationRequired",reconciliation);
        return result;
    }
    /** Executed while holding the existing project write lock; all save paths share this cap. */
    void cap(Map<String,Object> agreement,BigDecimal amount) {
        if(!Objects.toString(agreement.get("reconciliationRequired"),"").isBlank())
            throw ApiProblem.invalid(agreement.get("reconciliationRequired").toString());
        if(amount.signum()<=0) throw ApiProblem.invalid("Enter a positive amount for this payment.");
        if(amount.compareTo(new BigDecimal(agreement.get("balance").toString()))>0)
            throw ApiProblem.invalid("Payment exceeds the remaining balance of ₹"+agreement.get("balance")+". Refresh the booking and collect only the amount due.");
    }
    void stamp(ObjectNode data,Map<String,Object> agreement,BigDecimal amount) {
        BigDecimal before=agreement==null?BigDecimal.ZERO:new BigDecimal(agreement.get("collected").toString());
        BigDecimal total=data.path("totalValue").decimalValue();
        if(agreement!=null) total=new BigDecimal(agreement.get("totalValue").toString());
        ObjectNode receipt=json.createObjectNode();
        receipt.put("previousCollected",before.toPlainString());
        receipt.put("totalCollected",before.add(amount).toPlainString());
        receipt.put("balanceAfter",total.subtract(before).subtract(amount).toPlainString());
        for(String key:List.of("ratePerSqYard","totalValue","buyerName","buyerPhone")) {
            if(agreement!=null) receipt.put(key,agreement.get(key).toString());
            else receipt.put(key,data.path(key).asText());
        }
        receipt.put("areaSqYards",agreement!=null?agreement.get("areaSqYards").toString():data.path("_lockedAreaSqYards").asText());
        data.set("_paymentReceipt",receipt);
    }
}
