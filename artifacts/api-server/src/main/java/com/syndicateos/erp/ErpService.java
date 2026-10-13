package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.*;
import com.syndicateos.workspace.CapitalAllocation;
import java.math.*;
import java.sql.Array;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;

/** Database-defined forms with trusted financial handlers. Client balances/statuses are never authoritative. */
@Service
public class ErpService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ErpAccess access;
    private final TransactionTemplate tx;
    private final ProjectCashAccountService cash;
    public ErpService(JdbcTemplate jdbc,ObjectMapper json,ErpAccess access,TransactionTemplate tx,ProjectCashAccountService cash) {
        this.jdbc=jdbc; this.json=json; this.access=access; this.tx=tx; this.cash=cash;
    }
    private JsonNode parse(Object value) {
        try { return json.readTree(value.toString()); }
        catch(Exception e) { throw new ApiProblem(503,"INVALID_CONFIGURATION","ERP configuration could not be read."); }
    }
    private boolean role(Map<String,Object> resource,String key,String role) {
        try { return Arrays.asList((String[])((Array)resource.get(key)).getArray()).contains(role); }
        catch(Exception e) { throw new IllegalStateException("Invalid resource role configuration",e); }
    }
    private Map<String,Object> resource(UUID release,String kind) {
        var rows=jdbc.queryForList("SELECT * FROM sos.erp_resources WHERE release_id=? AND kind=?",release,kind);
        if(rows.isEmpty()) throw ApiProblem.invalid("This record type is not configured for your sector.");
        var row=rows.getFirst();
        row.put("fields",ErpConfiguration.effectiveFields(kind,parse(row.get("fields")),jdbc).toString());
        return row;
    }
    public Map<String,Object> read(SessionAccount actor,UUID project) {
        var snapshot=new TransactionTemplate(Objects.requireNonNull(tx.getTransactionManager()));
        snapshot.setReadOnly(true);
        snapshot.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        return snapshot.execute(status -> {
            var scope=access.project(actor,project,"erp.read",false);
            UUID release=(UUID)scope.get("release_id");
            boolean writable=Boolean.TRUE.equals(scope.get("assignment_enabled")) && "ACTIVE".equals(scope.get("status"));
            List<Map<String,Object>> resources=new ArrayList<>();
            for(var r:jdbc.queryForList("SELECT * FROM sos.erp_resources WHERE release_id=? ORDER BY kind",release))
                resources.add(Map.of("kind",r.get("kind"),"title",r.get("title"),"fields",ErpConfiguration.effectiveFields(r.get("kind").toString(),parse(r.get("fields")),jdbc),
                    "canCreate",writable&&role(r,"submit_roles",actor.role()),"canManage",writable&&role(r,"manage_roles",actor.role()),
                    "canReview",false,"canReviewOwn",false));
            List<Map<String,Object>> records=new ArrayList<>();
            for(var r:jdbc.queryForList("SELECT e.*,i.display_name AS creator_name FROM sos.erp_records e JOIN sos.identities i ON i.id=e.created_by WHERE e.project_id=? AND e.status<>'deleted' ORDER BY e.created_at DESC",project)) {
                ObjectNode recordData=(ObjectNode)parse(r.get("data"));
                if("accounts".equals(r.get("kind"))) recordData.put("isDefaultCash",cash.isDefault((UUID)r.get("id")));
                if("PARTNER".equals(actor.role())&&"accounts".equals(r.get("kind"))&&recordData.hasNonNull("accountNumber")) {
                    String number=recordData.path("accountNumber").asText();
                    recordData.put("accountNumber","••••"+number.substring(Math.max(0,number.length()-4)));
                }
                if(Set.of("plots","units").contains(r.get("kind"))&&jdbc.queryForObject(
                    "SELECT count(*) FROM sos.erp_inventory_reservations WHERE inventory_id=? AND state='active'",Integer.class,r.get("id"))>0)
                    recordData.put("status","plots".equals(r.get("kind"))?"reserved":"booked");
                records.add(Map.of("id",r.get("id"),"kind",r.get("kind"),"status",r.get("status"),"revision",r.get("revision"),
                    "createdBy",r.get("created_by"),"createdByName",r.get("creator_name"),"createdAt",r.get("created_at").toString(),"data",recordData));
            }
            var balances=jdbc.queryForList("""
                SELECT a.id AS "accountId",coalesce(sum(p.debit-p.credit),0)::text AS balance
                FROM sos.erp_records a LEFT JOIN sos.erp_postings p ON p.account_id=a.id
                WHERE a.project_id=? AND a.kind='accounts' AND a.status='approved' GROUP BY a.id
                """,project);
            Map<String,Object> settings=settings(project);
            var partners=partners(project,settings);
            var audit=jdbc.queryForList("""
                SELECT a.id,i.display_name AS actor,a.event,a.created_at::text AS timestamp
                FROM sos.erp_audit a JOIN sos.identities i ON i.id=a.actor_id
                WHERE a.project_id=? ORDER BY a.created_at DESC LIMIT 500
                """,project);
            Map<String,Object> result=new LinkedHashMap<>(Map.of("projectId",project,"resources",resources,"records",records,"balances",balances,
                "partners",partners,"audit",audit,"settings",settings,"projectSetup",projectPolicy(release),
                "statement",new FinancialStatementService(jdbc,json).read(project,actor,writable,release),
                "reviewableRecordIds",List.of()));
            result.put("bookingPayments",new BookingPayments(jdbc,json).read(project));
            return result;
        });
    }
    private JsonNode projectPolicy(UUID release) {
        var rows=jdbc.queryForList("SELECT definition FROM sos.project_setup_effective_definitions WHERE release_id=?",release);
        return rows.isEmpty()?json.createObjectNode():parse(rows.getFirst().get("definition"));
    }
    private Map<String,Object> settings(UUID project) {
        var rows=jdbc.queryForList("SELECT revision,data FROM sos.erp_project_settings WHERE project_id=?",project);
        Map<String,Object> result=new LinkedHashMap<>();
        if(rows.isEmpty()) { result.put("revision",0); result.put("equitySplitMode","fixed"); result.put("ledgerMode","internal_syndicate"); }
        else { parse(rows.getFirst().get("data")).fields().forEachRemaining(e->result.put(e.getKey(),e.getValue())); result.put("revision",rows.getFirst().get("revision")); }
        return result;
    }
    private List<Map<String,Object>> partners(UUID project,Map<String,Object> settings) {
        List<Map<String,Object>> partners=new ArrayList<>();
        BigDecimal total=jdbc.queryForObject("SELECT coalesce(sum(amount),0) FROM sos.erp_records WHERE project_id=? AND kind='investments' AND status='approved'",BigDecimal.class,project);
        for(var p:jdbc.queryForList("""
            SELECT i.id,coalesce(pm.display_name,i.display_name) AS display_name,i.mobile,pm.enabled,pm.revision FROM sos.identities i JOIN sos.project_memberships pm ON pm.identity_id=i.id
            JOIN sos.firm_memberships fm ON fm.identity_id=i.id AND fm.firm_id=pm.firm_id AND fm.role_code='PARTNER'
            WHERE pm.project_id=? AND fm.enabled AND i.enabled ORDER BY i.display_name
            """,project)) {
            UUID id=(UUID)p.get("id");
            BigDecimal invested=sum(project,id,"investments"),drawings=sum(project,id,"drawings").add(sum(project,id,"stock-draws"));
            BigDecimal expenses=jdbc.queryForObject("""
                SELECT coalesce(sum(amount),0) FROM sos.erp_records
                WHERE project_id=? AND partner_id=? AND kind='expenses' AND status='approved'
                  AND data->>'paymentSource'='individual'
                """,BigDecimal.class,project,id);
            BigDecimal equity=BigDecimal.ZERO;
            String split=Objects.toString(settings.get("equitySplitMode"),"fixed").replace("\"","");
            if("proportional".equals(split)) { if(total.signum()>0) equity=invested.multiply(new BigDecimal("100")).divide(total,4,RoundingMode.HALF_UP); }
            else {
                var profiles=jdbc.queryForList("SELECT data FROM sos.erp_records WHERE project_id=? AND kind='partner-profiles' AND partner_id=? AND status='approved'",project,id);
                if(!profiles.isEmpty()) equity=decimal(parse(profiles.getFirst().get("data")).path("fixedEquityPercent"),false);
            }
            partners.add(Map.of("id",id,"name",p.get("display_name"),"mobile",p.get("mobile"),"invested",invested.toPlainString(),
                "drawings",drawings.toPlainString(),"expenses",expenses.toPlainString(),"equityPercent",equity.toPlainString(),
                "enabled",p.get("enabled"),"revision",p.get("revision")));
        }
        return partners;
    }
    private BigDecimal sum(UUID project,UUID partner,String kind) {
        return jdbc.queryForObject("SELECT coalesce(sum(amount),0) FROM sos.erp_records WHERE project_id=? AND partner_id=? AND kind=? AND status='approved'",BigDecimal.class,project,partner,kind);
    }
    public Map<String,Object> execute(SessionAccount actor,String action,JsonNode input) {
        actor.business();
        return tx.execute(status -> {
            UUID project=Values.id(input,"projectId");
            if("erp.review".equals(action)) throw ApiProblem.invalid("Approvals have been removed. Use Refer Back to correct an entry.");
            String permission=switch(action) { case "erp.save","erp.bulk-save","erp.refer-back","erp.resubmit"->"erp.submit"; default->"erp.manage"; };
            var scope=access.project(actor,project,permission,true);
            UUID release=(UUID)scope.get("release_id");
            if("erp.settings".equals(action)) return updateSettings(actor,project,input);
            if("erp.inventory-stage".equals(action)) return inventoryStage(actor,project,release,input);
            if("erp.save".equals(action)) return save(actor,project,release,input);
            if("erp.refer-back".equals(action)) return referBack(actor,project,release,input);
            if("erp.resubmit".equals(action)) return resubmit(actor,project,release,input);
            if("erp.bulk-save".equals(action)) {
                String kind=Values.text(input,"kind",40);
                if(!Set.of("plots","units").contains(kind)||!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
                JsonNode rows=input.path("records");
                if(!rows.isArray()||rows.isEmpty()||rows.size()>2000) throw ApiProblem.invalid("Submit 1–2000 inventory rows per explicitly confirmed batch.");
                UUID request=Values.id(input,"requestId");
                List<Object> ids=new ArrayList<>();
                for(int i=0;i<rows.size();i++) {
                    ObjectNode row=json.createObjectNode().put("kind",kind).put("requestId",
                        UUID.nameUUIDFromBytes((request+":"+i).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());
                    row.set("data",rows.get(i));
                    ids.add(save(actor,project,release,row).get("entity"));
                }
                return Map.of("status","ok","entity",Map.of("records",ids,"count",ids.size()));
            }
            var record=record(project,Values.id(input,"recordId"));
            if(cash.isDefault((UUID)record.get("id"))) throw ApiProblem.invalid("The default project cash account cannot be edited or removed.");
            var definition=resource(release,(String)record.get("kind"));
            if(((Integer)record.get("revision"))!=Values.revision(input)) throw ApiProblem.conflict();
            if("erp.delete".equals(action)) {
                if(!role(definition,"manage_roles",actor.role()) || posted((UUID)record.get("id"))) throw ApiProblem.denied();
                if("approved".equals(record.get("status")) && Boolean.TRUE.equals(definition.get("financial"))) throw ApiProblem.denied();
                if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE (account_id=? OR inventory_id=?) AND status<>'deleted'",Integer.class,record.get("id"),record.get("id"))>0)
                    throw ApiProblem.invalid("This record is referenced. Keep its history instead of deleting it.");
                jdbc.update("UPDATE sos.erp_records SET status='deleted',revision=revision+1 WHERE id=?",record.get("id"));
                if("bookings".equals(record.get("kind")))
                    jdbc.update("UPDATE sos.erp_inventory_reservations SET state='released' WHERE booking_id=? AND state='active'",record.get("id"));
                audit(actor,project,(UUID)record.get("id"),"RECORD_REMOVED");
                return ok(record.get("id"));
            }
            throw new ApiProblem(404,"UNKNOWN_COMMAND","Unknown ERP command.");
        });
    }
    private Map<String,Object> record(UUID project,UUID id) {
        var rows=jdbc.queryForList("SELECT * FROM sos.erp_records WHERE id=? AND project_id=? AND status<>'deleted' FOR UPDATE",id,project);
        if(rows.isEmpty()) throw ApiProblem.denied();
        return rows.getFirst();
    }
    private boolean posted(UUID id) { return jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE record_id=?",Integer.class,id)>0; }
    private static final Set<String> CORRECTABLE=Set.of("expenses","investments","drawings","bookings","transactions","reimbursements","settlements","stock-draws");
    private void notifyActivity(SessionAccount actor,UUID project,UUID record,String title,String message) {
        jdbc.update("INSERT INTO sos.project_notifications(id,project_id,record_id,actor_id,title,message) VALUES(?,?,?,?,?,?)",
            UUID.randomUUID(),project,record,actor.identityId(),title,message);
    }
    private Map<String,Object> referBack(SessionAccount actor,UUID project,UUID release,JsonNode input) {
        UUID id=Values.id(input,"recordId"),request=Values.id(input,"requestId");
        String reason=Values.text(input,"reason",1000);
        var original=record(project,id);
        if(request.equals(original.get("refer_request_id")) && actor.identityId().equals(original.get("refer_actor_id"))) {
            if(!reason.equals(original.get("correction_reason"))) throw ApiProblem.conflict();
            return ok(id);
        }
        if((Integer)original.get("revision")!=Values.revision(input)) throw ApiProblem.conflict();
        if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND created_by=? AND request_id=?",
            Integer.class,project,actor.identityId(),request)>0) throw ApiProblem.conflict();
        String kind=original.get("kind").toString();
        if(!CORRECTABLE.contains(kind) || original.get("reversal_of")!=null ||
            !Set.of("approved","pending").contains(original.get("status"))) throw ApiProblem.invalid("This entry cannot be referred back.");
        var definition=resource(release,kind);
        if(!role(definition,"submit_roles",actor.role())) throw ApiProblem.denied();
        // Posted downstream receipts/reimbursements cannot be orphaned by correction.
        if(jdbc.queryForObject("""
            SELECT count(*) FROM sos.erp_records WHERE project_id=? AND id<>?
              AND status IN ('approved','pending')
              AND (data->>'bookingId'=? OR data->>'expenseId'=?)
            """,Integer.class,project,id,id.toString(),id.toString())>0)
            throw ApiProblem.invalid("Correct the linked receipt or reimbursement first. This entry has dependent records.");
        if("bookings".equals(kind) && !parse(original.get("data")).hasNonNull("_bookingRootId")) {
            UUID inventory=(UUID)original.get("inventory_id");
            var item=record(project,inventory);
            ObjectNode d=(ObjectNode)parse(item.get("data"));
            boolean originalPosted="approved".equals(original.get("status"));
            if(originalPosted) {
                String expected="plots".equals(item.get("kind"))?"reserved":"booked";
                if(!expected.equals(d.path("status").asText()) ||
                    jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND inventory_id=? AND kind='bookings' AND status='approved' AND id<>?",
                        Integer.class,project,inventory,id)>0)
                    throw ApiProblem.invalid("A sold/registered booking or inventory with another live booking cannot be referred back.");
                if(original.get("inventory_before")!=null) d=(ObjectNode)parse(original.get("inventory_before"));
                else {
                    d.put("status","available");
                    for(String key:List.of("buyerName","buyerPhone","buyerRegistrationId","advanceReceived","paymentMode","paymentRefNumber",
                        "paymentMilestone","currentMilestone","bookingAccountId","bookedAt"))
                        d.remove(key);
                }
                jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",d.toString(),inventory);
            }
            jdbc.update("UPDATE sos.erp_inventory_reservations SET state='released' WHERE booking_id=?",id);
            if(original.get("inventory_id")!=null)
                RegistrationService.invalidate(jdbc,(UUID)original.get("inventory_id"),"cancelled");
        }
        var legs=jdbc.queryForList("SELECT account_id,ledger_code,debit,credit FROM sos.erp_postings WHERE record_id=? ORDER BY id",id);
        // Reversing a receipt already spent may not make a project account negative.
        for(var delta:jdbc.queryForList("""
            SELECT account_id,sum(debit-credit) AS delta FROM sos.erp_postings
            WHERE record_id=? AND account_id IS NOT NULL GROUP BY account_id
            """,id)) {
            BigDecimal balance=jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE account_id=?",BigDecimal.class,delta.get("account_id"));
            if(balance.subtract((BigDecimal)delta.get("delta")).signum()<0)
                throw ApiProblem.invalid("Refer Back would make the project account negative. Correct the later spending first.");
        }
        if(!legs.isEmpty()) {
            UUID reversal=UUID.randomUUID();
            BigDecimal accountDelta=legs.stream().filter(l->l.get("account_id")!=null)
                .map(l->((BigDecimal)l.get("debit")).subtract((BigDecimal)l.get("credit"))).reduce(BigDecimal.ZERO,BigDecimal::add);
            ObjectNode reversalData=json.createObjectNode().put("description","Reversal: "+reason)
                .put("date",LocalDate.now().toString()).put("type",accountDelta.signum()>0?"debit":"credit")
                .put("referenceNo",id.toString()).put("category","correction_reversal");
            jdbc.update("""
                INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,account_id,status,created_by,request_id,reversal_of)
                VALUES(?,?,?,'transactions',?::jsonb,?::jsonb,?,?,'approved',?,?,?)
                """,reversal,project,actor.firmId(),reversalData.toString(),reversalData.toString(),original.get("amount"),
                original.get("account_id"),actor.identityId(),request,id);
            for(var leg:legs) {
                BigDecimal debit=(BigDecimal)leg.get("debit"),credit=(BigDecimal)leg.get("credit");
                if(debit.signum()>0) post(reversal,project,(UUID)leg.get("account_id"),leg.get("ledger_code").toString(),debit,false);
                else if(credit.signum()>0) post(reversal,project,(UUID)leg.get("account_id"),leg.get("ledger_code").toString(),credit,true);
            }
            audit(actor,project,reversal,"ENTRY_REVERSED");
        }
        jdbc.update("""
            UPDATE sos.erp_records SET status='referred_back',correction_reason=?,refer_request_id=?,refer_actor_id=?,revision=revision+1
            WHERE id=?
            """,reason,request,actor.identityId(),id);
        audit(actor,project,id,"REFERRED_BACK");
        notifyActivity(actor,project,id,"Entry referred back",actor.displayName()+" referred back "+kind+": "+reason+". The original author can correct and resubmit.");
        return ok(id);
    }
    private Map<String,Object> resubmit(SessionAccount actor,UUID project,UUID release,JsonNode input) {
        UUID id=Values.id(input,"recordId"),request=Values.id(input,"requestId");
        var original=record(project,id);
        if(!actor.identityId().equals(original.get("created_by"))) throw ApiProblem.denied();
        if(original.get("replacement_id")!=null) {
            var replacement=record(project,(UUID)original.get("replacement_id"));
            if(request.equals(replacement.get("request_id")) && parse(replacement.get("request_data")).equals(input.path("data")))
                return ok(replacement.get("id"));
            throw ApiProblem.conflict();
        }
        if((Integer)original.get("revision")!=Values.revision(input) ||
            !CORRECTABLE.contains(original.get("kind")) || original.get("reversal_of")!=null)
            throw ApiProblem.conflict();
        if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND created_by=? AND request_id=?",
            Integer.class,project,actor.identityId(),request)>0) throw ApiProblem.conflict();
        if("pending".equals(original.get("status"))) {
            ObjectNode referral=json.createObjectNode().put("recordId",id.toString()).put("requestId",UUID.nameUUIDFromBytes(("legacy:"+request).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString())
                .put("revision",(Integer)original.get("revision")).put("reason","Correcting a historical unposted entry");
            referBack(actor,project,release,referral);
        } else if(!"referred_back".equals(original.get("status"))) throw ApiProblem.invalid("Refer this entry back before editing.");
        ObjectNode command=json.createObjectNode().put("kind",original.get("kind").toString()).put("requestId",request.toString());
        command.set("data",input.path("data"));
        var result=save(actor,project,release,command);
        UUID replacement=UUID.fromString(((Map<?,?>)result.get("entity")).get("id").toString());
        if(replacement.equals(id)) throw ApiProblem.conflict();
        var newRecord=record(project,replacement);
        if(newRecord.get("correction_of")!=null) throw ApiProblem.conflict();
        jdbc.update("UPDATE sos.erp_records SET correction_of=? WHERE id=?",id,replacement);
        jdbc.update("UPDATE sos.erp_records SET status='superseded',replacement_id=?,revision=revision+1 WHERE id=?",replacement,id);
        audit(actor,project,replacement,"CORRECTION_RESUBMITTED");
        return result;
    }
    private Map<String,Object> save(SessionAccount actor,UUID project,UUID release,JsonNode input) {
        String kind=Values.text(input,"kind",40);
        var def=resource(release,kind);
        UUID request=Values.id(input,"requestId");
        var duplicate=jdbc.queryForList("SELECT id,kind,request_data FROM sos.erp_records WHERE project_id=? AND created_by=? AND request_id=?",project,actor.identityId(),request);
        if(!duplicate.isEmpty()) {
            if(!kind.equals(duplicate.getFirst().get("kind")) || !parse(duplicate.getFirst().get("request_data")).equals(input.path("data"))) throw ApiProblem.conflict();
            return ok(duplicate.getFirst().get("id"));
        }
        if(!role(def,"submit_roles",actor.role())) throw ApiProblem.denied();
        boolean hasAccount=false;
        for(JsonNode field:parse(def.get("fields"))) if("accountId".equals(field.path("key").asText())) hasAccount=true;
        if(!input.path("data").isObject()) throw ApiProblem.invalid("Supply a record object.");
        ObjectNode submission=(ObjectNode)input.path("data").deepCopy();
        boolean selectedAccountRouting=false;
        if(Set.of("expenses","investments","bookings").contains(kind)) {
            var modes=jdbc.queryForList("""
                SELECT metadata->>'canonicalValue' AS canonical_value,metadata->>'accountRouting' AS account_routing FROM sos.business_masters
                WHERE group_code IN ('expense_payment_modes','cash_investment_modes','bank_investment_modes','booking_payment_modes')
                  AND value_code=? AND enabled AND metadata->>'canonicalValue' IS NOT NULL
                """,submission.path("paymentMode").asText());
            if(!modes.isEmpty()&&modes.getFirst().get("canonical_value") instanceof String canonical&&!canonical.isBlank()) {
                submission.put("paymentMode",canonical);
                selectedAccountRouting="selected".equals(modes.getFirst().get("account_routing"));
            }
        }
        if(hasAccount&&!selectedAccountRouting) submission=cash.route(actor,project,kind,submission);
        // The original spender selector includes the authenticated accountant for
        // project-paid expenses. Resolve it here; never fabricate a partner or
        // attribute a bank expense to an accountant's partner-capital ledger.
        if("expenses".equals(kind)&&"ACCOUNTANT".equals(actor.role())
            &&"project_bank".equals(submission.path("paymentSource").asText())
            &&(!submission.hasNonNull("partnerId")||submission.path("partnerId").asText().isBlank()))
            submission.put("partnerId",actor.identityId().toString());
        ObjectNode data=validate(def,submission);
        UUID id=input.hasNonNull("recordId")?Values.id(input,"recordId"):UUID.randomUUID();
        Map<String,Object> previous=null;
        if(input.hasNonNull("recordId")) {
            previous=record(project,id);
            if(Boolean.TRUE.equals(def.get("financial")) || "bookings".equals(kind))
                throw ApiProblem.invalid("Use Refer Back and Correct & Resubmit on the project statement. Financial entries cannot be overwritten.");
            if(!kind.equals(previous.get("kind")) || !role(def,"manage_roles",actor.role()) || posted(id) && !"accounts".equals(kind)
                || Boolean.TRUE.equals(def.get("financial")) && "approved".equals(previous.get("status"))) throw ApiProblem.denied();
            if(((Integer)previous.get("revision"))!=Values.revision(input)) throw ApiProblem.conflict();
            if("accounts".equals(kind) && decimal(data.path("openingBalance"),false).compareTo(decimal(parse(previous.get("data")).path("openingBalance"),false))!=0)
                throw ApiProblem.invalid("Opening balance is immutable. Record a documented correcting transaction.");
        }
        if("accounts".equals(kind) && previous!=null && cash.isDefault(id))
            throw ApiProblem.invalid("The default project cash account cannot be edited. Record a cash transaction instead.");
        UUID partner=optionalId(data,"partnerId"),account=optionalId(data,"accountId"),inventory=optionalId(data,"inventoryId");
        if("expenses".equals(kind)&&"ACCOUNTANT".equals(actor.role())
            &&"project_bank".equals(data.path("paymentSource").asText())&&actor.identityId().equals(partner)) {
            partner=null;
            data.remove("partnerId");
        }
        for(String field:List.of("attachmentId","receiptAttachmentId","voiceAttachmentId")) {
            UUID attachment=optionalId(data,field);
            if(attachment!=null && jdbc.queryForObject("SELECT count(*) FROM sos.erp_attachments WHERE id=? AND project_id=?",Integer.class,attachment,project)==0)
                throw ApiProblem.invalid("Choose an uploaded attachment belonging to this project.");
        }
        if(Set.of("investments","expenses","drawings").contains(kind) && "PARTNER".equals(actor.role())) {
            if(partner==null) { partner=actor.identityId(); data.put("partnerId",partner.toString()); }
            if(!partner.equals(actor.identityId())) throw ApiProblem.denied();
        }
        if(partner!=null && jdbc.queryForObject("SELECT count(*) FROM sos.project_memberships WHERE project_id=? AND identity_id=? AND enabled",Integer.class,project,partner)==0)
            throw ApiProblem.invalid("Choose an active partner of this project.");
        if("partner-profiles".equals(kind) && partner!=null) {
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND partner_id=? AND kind='partner-profiles' AND status<>'deleted' AND id<>?",Integer.class,project,partner,id)>0)
                throw ApiProblem.invalid("This partner already has an equity profile. Edit that profile.");
            BigDecimal other=jdbc.queryForObject("SELECT coalesce(sum((data->>'fixedEquityPercent')::numeric),0) FROM sos.erp_records WHERE project_id=? AND kind='partner-profiles' AND status='approved' AND id<>?",BigDecimal.class,project,id);
            if(other.add(decimal(data.path("fixedEquityPercent"),false)).compareTo(new BigDecimal("100"))>0) throw ApiProblem.invalid("Total fixed equity cannot exceed 100%.");
            JsonNode policy=projectPolicy(release);
            JsonNode values=parse(jdbc.queryForObject("SELECT details FROM sos.projects WHERE id=? FOR UPDATE",Object.class,project));
            CapitalAllocation.validate(policy,values,List.of(data),false);
            List<JsonNode> allocations=new ArrayList<>(jdbc.queryForList(
                "SELECT data FROM sos.erp_records WHERE project_id=? AND kind='partner-profiles' AND status='approved' AND id<>?",project,id)
                .stream().map(p->parse(p.get("data"))).toList());
            allocations.add(data);
            CapitalAllocation.validate(policy,values,allocations,false,false);
        }
        if(account!=null) {
            var a=record(project,account);
            if(!"accounts".equals(a.get("kind")) || !"approved".equals(a.get("status")) || !"active".equals(parse(a.get("data")).path("status").asText("active")))
                throw ApiProblem.invalid("Choose an active project bank or cash account.");
        }
        if(inventory!=null) {
            var item=record(project,inventory);
            if(!Set.of("plots","units").contains(item.get("kind"))) throw ApiProblem.invalid("Choose valid project inventory.");
            boolean subsequentPlotPayment="bookings".equals(kind) && "plots".equals(item.get("kind"))
                && Set.of("reserved","sold").contains(parse(item.get("data")).path("status").asText())
                && new BookingPayments(jdbc,json).active(project,inventory)!=null;
            if(!bookable(parse(item.get("data"))) && !subsequentPlotPayment) throw ApiProblem.conflict();
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_inventory_reservations WHERE inventory_id=? AND state='active' AND booking_id<>?",Integer.class,inventory,id)>0)
                throw new ApiProblem(409,"INVENTORY_RESERVED","This inventory is already reserved by a pending booking.");
        }
        BigDecimal amount=switch(kind) {
            case "stock-draws"->decimal(data.path("retailValuation"),true);
            case "bookings"->decimal(data.path("advanceReceived"),false);
            case "settlements"->decimal(data.path("cashCollected"),false).add(decimal(data.path("upiCollected"),false));
            default->data.has("amount")?decimal(data.path("amount"),true):BigDecimal.ZERO;
        };
        if("settlements".equals(kind)) {
            BigDecimal sold=decimal(data.path("openingBottles"),false).add(decimal(data.path("receivedBottles"),false)).subtract(decimal(data.path("closingBottles"),false));
            if(sold.signum()<0) throw ApiProblem.invalid("Closing stock exceeds opening plus received stock.");
            data.put("bottlesSold",sold);
            BigDecimal gross=sold.multiply(decimal(data.path("avgBottlePrice"),false));
            data.put("grossSalesValue",gross);
            data.put("counterShortage",gross.subtract(amount));
        }
        if(Set.of("transactions","investments","drawings","settlements").contains(kind) && account==null
            || "expenses".equals(kind) && "project_bank".equals(data.path("paymentSource").asText()) && account==null)
            throw ApiProblem.invalid("Select the exact project account. No fallback account will be used.");
        if("transactions".equals(kind)&&data.hasNonNull("bookingId")&&!data.path("bookingId").asText().isBlank()) {
            var booking=record(project,Values.id(data,"bookingId"));
            if(!"bookings".equals(booking.get("kind"))||!"approved".equals(booking.get("status"))||!"credit".equals(data.path("type").asText()))
                throw ApiProblem.invalid("Customer receipts require a recorded booking in this project.");
            var payments=new BookingPayments(jdbc,json);
            var agreement=payments.active(project,(UUID)booking.get("inventory_id"));
            if(agreement==null && "plots".equals(record(project,(UUID)booking.get("inventory_id")).get("kind")))
                throw ApiProblem.invalid("The active sale agreement could not be verified. Reconcile this booking before collecting more money.");
            if(agreement!=null) {
                payments.cap(agreement,amount);
                payments.stamp(data,agreement,amount);
            }
        }
        if("bookings".equals(kind)&&decimal(data.path("advanceReceived"),false).signum()>0 && account==null)
            throw ApiProblem.invalid("Choose the exact receiving project account for this customer advance.");
        if("expenses".equals(kind)&&"individual".equals(data.path("paymentSource").asText())) {
            if(account!=null) throw ApiProblem.invalid("An individual-paid expense must not debit a project bank account.");
            if(partner==null) throw ApiProblem.invalid("Choose the actual partner who funded this expense.");
        }
        if("bookings".equals(kind)&&data.hasNonNull("buyerRegistrationId")&&!data.path("buyerRegistrationId").asText().isBlank())
            throw new ApiProblem(503,"PROTECTED_STORAGE_REQUIRED","Full registration identifiers cannot be collected until encrypted storage is configured.");
        if("reimbursements".equals(kind)) {
            var expense=record(project,Values.id(data,"expenseId"));
            if(!"expenses".equals(expense.get("kind"))||!"approved".equals(expense.get("status"))
                ||!"individual".equals(parse(expense.get("data")).path("paymentSource").asText()))
                throw ApiProblem.invalid("Choose a recorded individual-paid expense in this project.");
            BigDecimal committed=jdbc.queryForObject("SELECT coalesce(sum(amount),0) FROM sos.erp_records WHERE project_id=? AND kind='reimbursements' AND status IN ('pending','approved') AND data->>'expenseId'=? AND id<>?",
                BigDecimal.class,project,expense.get("id").toString(),id);
            if(committed.add(amount).compareTo((BigDecimal)expense.get("amount"))>0) throw ApiProblem.invalid("Reimbursement exceeds the unsettled individual expense.");
            if(account==null) throw ApiProblem.invalid("Choose the paying project account.");
            partner=(UUID)expense.get("partner_id");
            if("PARTNER".equals(actor.role())&&!actor.identityId().equals(partner)) throw ApiProblem.denied();
        }
        if("accounts".equals(kind)) {
            if(previous!=null&&parse(previous.get("data")).hasNonNull("openingBalanceDate")
                &&!parse(previous.get("data")).path("openingBalanceDate").equals(data.path("openingBalanceDate")))
                throw ApiProblem.invalid("The opening-balance effective date is immutable.");
            if(data.path("isPrimary").asBoolean()) {
                for(var a:jdbc.queryForList("SELECT id,data FROM sos.erp_records WHERE project_id=? AND kind='accounts' AND status='approved' AND id<>?",project,id)) {
                    ObjectNode old=(ObjectNode)parse(a.get("data"));
                    if(old.path("isPrimary").asBoolean()) {
                        old.put("isPrimary",false);
                        jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",old.toString(),a.get("id"));
                    }
                }
            }
        }
        if("bookings".equals(kind)&&inventory!=null) {
            data.put("buyerPhone",Values.mobile(data.path("buyerPhone").asText()));
            var item=record(project,inventory);
            JsonNode inventoryData=parse(item.get("data"));
            if("plots".equals(item.get("kind"))) {
                var payments=new BookingPayments(jdbc,json);
                var agreement=payments.active(project,inventory);
                BigDecimal proposed=data.hasNonNull("ratePerSqYard")?decimal(data.path("ratePerSqYard"),true):decimal(inventoryData.path("ratePerSqYard"),true);
                JsonNode details=parse(jdbc.queryForObject("SELECT details::text FROM sos.projects WHERE id=?",String.class,project));
                if(agreement==null && details.hasNonNull("floorRatePerSqYard")&&proposed.compareTo(details.path("floorRatePerSqYard").decimalValue())<0)
                    throw ApiProblem.invalid("This rate is below the protected project floor. Correct the rate or update the project's floor rate before recording the booking.");
                if(agreement!=null) {
                    payments.cap(agreement,amount);
                    if(proposed.compareTo(new BigDecimal(agreement.get("ratePerSqYard").toString()))!=0
                        || !data.path("buyerName").asText().equals(agreement.get("buyerName"))
                        || !data.path("buyerPhone").asText().equals(agreement.get("buyerPhone")))
                        throw ApiProblem.invalid("The buyer and agreed rate are locked. Record a new payment without changing the sale agreement.");
                    data.put("_bookingRootId",agreement.get("bookingId").toString());
                }
                data.put("ratePerSqYard",proposed);
                BigDecimal area=agreement==null?decimal(inventoryData.path("areaSqYards"),true):new BigDecimal(agreement.get("areaSqYards").toString());
                BigDecimal total=proposed.multiply(area);
                data.put("_lockedAreaSqYards",area);
                data.put("totalValue",total);
                if(decimal(data.path("advanceReceived"),false).compareTo(total)>0) throw ApiProblem.invalid("The token exceeds the agreed sale value.");
                payments.stamp(data,agreement,amount);
            }
        }
        if(Set.of("plots","units").contains(kind)) {
            if("plots".equals(kind) && previous!=null &&
                !"available".equals(parse(previous.get("data")).path("status").asText("available")))
                throw ApiProblem.invalid("Booked or sold plots are protected. Use the booking workflow instead of changing plot details.");
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_inventory_reservations WHERE inventory_id=? AND state='active'",Integer.class,id)>0)
                throw ApiProblem.invalid("Inventory with a pending reservation cannot be changed.");
            String numberKey="plots".equals(kind)?"plotNumber":"unitNumber";
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND kind=? AND data->>?=? AND status<>'deleted' AND id<>?",
                Integer.class,project,kind,numberKey,data.path(numberKey).asText(),id)>0) throw ApiProblem.invalid("This inventory number already exists in the project.");
            if(previous==null && !"available".equals(data.path("status").asText("available"))) throw ApiProblem.invalid("Create available inventory, then use the booking workflow.");
            if(previous!=null && !parse(previous.get("data")).path("status").asText("available").equals(data.path("status").asText("available")))
                throw ApiProblem.invalid("Inventory status is changed through recorded bookings, not direct edits.");
        }
        // "approved" is the legacy storage code for an active/posted record, not a vote.
        String state="approved";
        if(previous==null) jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,partner_id,account_id,inventory_id,status,created_by,request_id)
            VALUES (?,?,?,?,?::jsonb,?::jsonb,?,?,?,?,?,?,?)
            """,id,project,actor.firmId(),kind,data.toString(),input.path("data").toString(),amount,partner,account,inventory,state,actor.identityId(),request);
        else {
            jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,request_data=?::jsonb,amount=?,partner_id=?,account_id=?,inventory_id=?,status=?,revision=revision+1,request_id=? WHERE id=?",
                data.toString(),input.path("data").toString(),amount,partner,account,inventory,state,request,id);
        }
        if("accounts".equals(kind) && previous==null) {
            BigDecimal opening=decimal(data.path("openingBalance"),false);
            if(opening.signum()>0) { post(id,project,id,"bank",opening,true); post(id,project,null,"opening-capital",opening,false); }
        }
        if("bookings".equals(kind)) {
            jdbc.update("INSERT INTO sos.erp_inventory_reservations(project_id,inventory_id,booking_id,state) VALUES (?,?,?,'cleared') ON CONFLICT(booking_id) DO UPDATE SET inventory_id=excluded.inventory_id,state='cleared'",
                project,inventory,id);
        }
        if(Boolean.TRUE.equals(def.get("financial")) || "bookings".equals(kind)) {
            applyPosting(project,record(project,id));
            audit(actor,project,id,"ENTRY_POSTED");
            notifyActivity(actor,project,id,"Entry recorded",kind+" recorded by "+actor.displayName()+". Project balances are updated.");
        }
        audit(actor,project,id,previous==null?"RECORD_CREATED":"RECORD_UPDATED");
        return ok(id);
    }
    private ObjectNode validate(Map<String,Object> definition,JsonNode input) {
        if(!input.isObject() || input.toString().length()>32000) throw ApiProblem.invalid("Supply a bounded record.");
        ObjectNode data=(ObjectNode)input.deepCopy();
        Set<String> allowed=new HashSet<>();
        for(JsonNode field:parse(definition.get("fields"))) {
            String key=field.path("key").asText(); allowed.add(key);
            JsonNode condition=field.path("visibleWhen");
            if(condition.isObject()) {
                boolean visible=false;
                for(JsonNode choice:condition.path("values"))
                    if(choice.asText().equals(input.path(condition.path("field").asText()).asText())) visible=true;
                if(!visible) {data.remove(key);continue;}
            }
            if(!data.has(key)&&field.has("default")) data.set(key,field.path("default"));
            JsonNode v=data.path(key);
            boolean absent=v.isMissingNode()||v.isNull()||v.isTextual()&&v.asText().isBlank();
            if(absent) { if(field.path("required").asBoolean()) throw ApiProblem.invalid(field.path("label").asText()+" is required."); continue; }
            String kind=field.path("kind").asText();
            if("number".equals(kind)) {
                BigDecimal n=decimal(v,false);
                if(field.has("min")&&n.compareTo(field.path("min").decimalValue())<0 || field.has("max")&&n.compareTo(field.path("max").decimalValue())>0)
                    throw ApiProblem.invalid("Value outside configured bounds: "+field.path("label").asText());
                data.put(key,n);
            } else if("boolean".equals(kind)) { if(!v.isBoolean()) throw ApiProblem.invalid(key+" must be a boolean."); }
            else if("date".equals(kind)) { try { LocalDate.parse(v.asText()); } catch(Exception e) { throw ApiProblem.invalid("Invalid date."); } }
            else if("select".equals(kind)) {
                boolean found=false; for(JsonNode option:field.path("options")) if(option.asText().equals(v.asText())) found=true;
                if(!found) throw ApiProblem.invalid("Choose a configured "+field.path("label").asText()+".");
            } else {
                if(!v.isTextual() || v.asText().length()>field.path("maxLength").asInt(4000)) throw ApiProblem.invalid(key+" must be bounded text.");
                String text=v.asText().trim();
                if(field.path("uppercase").asBoolean()) text=text.toUpperCase(Locale.ROOT);
                if(field.has("pattern")&&!text.matches(field.path("pattern").asText())) throw ApiProblem.invalid("Enter a valid "+field.path("label").asText()+".");
                data.put(key,text);
            }
        }
        data.fieldNames().forEachRemaining(k->{if(!allowed.contains(k)) throw ApiProblem.invalid("Unconfigured record field: "+k);});
        return data;
    }
    private BigDecimal decimal(JsonNode value,boolean positive) {
        try {
            BigDecimal n=value.isMissingNode()||value.isNull()?BigDecimal.ZERO:new BigDecimal(value.asText()).setScale(2,RoundingMode.UNNECESSARY);
            if(n.signum()<0 || positive&&n.signum()==0 || n.precision()>18) throw new NumberFormatException();
            return n;
        } catch(Exception e) { throw ApiProblem.invalid("Use a valid nonnegative amount with at most two decimal places."); }
    }
    private UUID optionalId(JsonNode data,String key) {
        if(!data.hasNonNull(key)||data.path(key).asText().isBlank()) return null;
        return Values.id(data,key);
    }
    private void applyPosting(UUID project,Map<String,Object> row) {
        UUID id=(UUID)row.get("id"),account=(UUID)row.get("account_id");
        String kind=(String)row.get("kind");
        JsonNode data=parse(row.get("data"));
        BigDecimal amount=(BigDecimal)row.get("amount");
        if("bookings".equals(kind)) {
            UUID inventory=(UUID)row.get("inventory_id");
            if(inventory==null) throw ApiProblem.invalid("Choose an inventory record.");
            var item=record(project,inventory);
            ObjectNode updated=(ObjectNode)parse(item.get("data"));
            if(data.hasNonNull("_bookingRootId")) {
                // Additional receipts never replace a buyer, reset a sale or reserve it again.
                amount=decimal(data.path("advanceReceived"),true);
            } else {
            if(!bookable(updated)) throw ApiProblem.conflict();
            jdbc.update("UPDATE sos.erp_records SET inventory_before=?::jsonb WHERE id=?",updated.toString(),id);
            updated.put("status","plots".equals(item.get("kind"))?"reserved":"booked");
            for(String key:List.of("buyerName","buyerPhone","buyerRegistrationId","ratePerSqYard","advanceReceived","paymentMode","paymentRefNumber","paymentMilestone"))
                if(data.has(key)) updated.set(key,data.path(key));
            updated.put("bookingAccountId",Objects.toString(row.get("account_id"),""));
            if(data.has("date")) updated.set("bookedAt",data.path("date"));
            jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",updated.toString(),inventory);
            amount=decimal(data.path("advanceReceived"),false);
            }
            if("plots".equals(item.get("kind"))&&"Registered & Cleared".equals(data.path("paymentMilestone").asText())) {
                // Explicit agreement completion stops reminders, never a sale transition.
                RegistrationService.invalidate(jdbc,inventory,"completed");
            }
        }
        if(amount.signum()==0) return;
        if("reimbursements".equals(kind)) {
            BigDecimal balance=jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE account_id=?",BigDecimal.class,account);
            if(balance.compareTo(amount)<0) throw ApiProblem.invalid("Insufficient cleared balance to reimburse.");
            post(id,project,account,"bank",amount,false);
            post(id,project,null,"partner-payable",amount,true);
            return;
        }
        boolean inflow=Set.of("investments","settlements","bookings").contains(kind) || "transactions".equals(kind)&&"credit".equals(data.path("type").asText());
        if(account!=null) {
            var a=record(project,account);
            if(!"accounts".equals(a.get("kind")) || !"active".equals(parse(a.get("data")).path("status").asText("active")))
                throw ApiProblem.invalid("The project account is no longer active.");
            BigDecimal balance=jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE account_id=?",BigDecimal.class,account);
            if(!inflow&&balance.compareTo(amount)<0) throw ApiProblem.invalid("Insufficient cleared project-account balance.");
            post(id,project,account,"bank",amount,inflow);
            post(id,project,null,inflow?"investments".equals(kind)?"partner-capital":"income":"drawings".equals(kind)?"partner-drawings":"expenses",amount,!inflow);
        } else if("expenses".equals(kind)) {
            post(id,project,null,"expenses",amount,true);
            post(id,project,null,"partner-payable",amount,false);
        } else if("stock-draws".equals(kind)) {
            post(id,project,null,"partner-drawings",amount,true);
            post(id,project,null,"stock",amount,false);
        } else throw ApiProblem.invalid("This financial record needs an explicit project account.");
    }
    private void post(UUID record,UUID project,UUID account,String code,BigDecimal amount,boolean debit) {
        jdbc.update("INSERT INTO sos.erp_postings(id,record_id,project_id,account_id,ledger_code,debit,credit) VALUES (?,?,?,?,?,?,?)",
            UUID.randomUUID(),record,project,account,code,debit?amount:BigDecimal.ZERO,debit?BigDecimal.ZERO:amount);
    }
    private Map<String,Object> updateSettings(SessionAccount actor,UUID project,JsonNode input) {
        if(!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
        JsonNode settings=input.path("settings");
        if(!settings.isObject() || settings.toString().length()>16000) throw ApiProblem.invalid("Supply bounded project settings.");
        Set<String> allowed=Set.of("equitySplitMode","ledgerMode","layoutCalculation","pricingMatrix","projectPlan");
        settings.fieldNames().forEachRemaining(k->{if(!allowed.contains(k)) throw ApiProblem.invalid("Unknown project setting.");});
        if(settings.has("equitySplitMode")&&!Set.of("fixed","proportional").contains(settings.path("equitySplitMode").asText())) throw ApiProblem.invalid("Invalid equity mode.");
        if(settings.has("ledgerMode")&&!Set.of("internal_syndicate","official_tax").contains(settings.path("ledgerMode").asText())) throw ApiProblem.invalid("Invalid ledger mode.");
        for(String key:List.of("layoutCalculation","pricingMatrix")) if(settings.has(key)) {
            if(!settings.path(key).isObject()) throw ApiProblem.invalid("Invalid calculation settings.");
            settings.path(key).fields().forEachRemaining(e->{if(e.getValue().isNumber()) decimal(e.getValue(),false); else if(!"unit".equals(e.getKey())) throw ApiProblem.invalid("Calculation inputs must be numbers.");});
        }
        if(settings.has("projectPlan")) {
            JsonNode plan=settings.path("projectPlan");
            if(!plan.isObject()||plan.toString().length()>12000) throw ApiProblem.invalid("Supply bounded project plan rows.");
            plan.fields().forEachRemaining(mode->{
                if(!Set.of("plots","units","liquor","infra").contains(mode.getKey())||!mode.getValue().isObject()) throw ApiProblem.invalid("Invalid project plan type.");
                mode.getValue().fields().forEachRemaining(e->{
                    if(!Set.of("distribution","startNumber","floorsCount","flats","amenities","counters","facilities","packages").contains(e.getKey()))
                        throw ApiProblem.invalid("Unconfigured project plan property.");
                    JsonNode value=e.getValue();
                    if(value.isArray()) {
                        if(value.size()>2000) throw ApiProblem.invalid("Plan row limit exceeded; use explicitly sized inventory batches.");
                        for(JsonNode row:value) if(!row.isObject()||row.toString().length()>2000) throw ApiProblem.invalid("Invalid plan row.");
                    } else if(!value.isTextual()&&!value.isNumber()) throw ApiProblem.invalid("Invalid plan value.");
                });
            });
        }
        int revision=input.path("revision").asInt(-1);
        jdbc.update("INSERT INTO sos.erp_project_settings(project_id) VALUES (?) ON CONFLICT DO NOTHING",project);
        if(revision==0) revision=1;
        if(jdbc.update("UPDATE sos.erp_project_settings SET data=data||?::jsonb,revision=revision+1 WHERE project_id=? AND revision=?",settings.toString(),project,revision)!=1) throw ApiProblem.conflict();
        audit(actor,project,null,"SETTINGS_UPDATED");
        return ok(project);
    }
    private boolean bookable(JsonNode inventory) {
        return "available".equals(inventory.path("status").asText("available"))
            || "blocked".equals(inventory.path("status").asText())
                && "accepted_blocked".equals(inventory.path("marketingRequest").path("status").asText());
    }
    private Map<String,Object> inventoryStage(SessionAccount actor,UUID project,UUID release,JsonNode input) {
        if(!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
        UUID id=Values.id(input,"recordId");
        var record=record(project,id);
        if(!Set.of("plots","units").contains(record.get("kind"))||(Integer)record.get("revision")!=Values.revision(input))
            throw ApiProblem.conflict();
        if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND inventory_id=? AND kind='bookings' AND status='approved'",Integer.class,project,id)==0)
            throw ApiProblem.invalid("Record a customer booking first.");
        ObjectNode data=(ObjectNode)parse(record.get("data"));
        String current=data.path("status").asText();
        String next=input.path("status").asText(current);
        boolean plot="plots".equals(record.get("kind"));
        if(!next.equals(current)&&!(plot&&"reserved".equals(current)&&"sold".equals(next) || !plot&&"booked".equals(current)&&"registered".equals(next)))
            throw ApiProblem.invalid("This inventory transition is not permitted.");
        data.put("status",next);
        for(String key:List.of("paymentMilestone","currentMilestone")) if(input.hasNonNull(key)) {
            String value=input.path(key).asText();
            Set<String> milestones=new HashSet<>();
            if(plot) {
                JsonNode bookingFields=parse(resource(release,"bookings").get("fields"));
                for(JsonNode field:bookingFields) if("paymentMilestone".equals(field.path("key").asText()))
                    for(JsonNode option:field.path("options")) milestones.add(option.asText());
            } else for(JsonNode milestone:projectPolicy(release).path("rules").path("milestones")) milestones.add(milestone.path("name").asText());
            if(!milestones.contains(value))
                throw ApiProblem.invalid("Choose a valid milestone.");
            data.put(key,value);
        }
        if(input.hasNonNull("officialDocValue")) data.put("officialDocValue",decimal(input.path("officialDocValue"),false));
        jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",data.toString(),id);
        if(plot&&("sold".equals(next)||"Registered & Cleared".equals(data.path("paymentMilestone").asText())))
            RegistrationService.invalidate(jdbc,id,"completed");
        audit(actor,project,id,"INVENTORY_STAGE_UPDATED");
        return ok(id);
    }
    private void audit(SessionAccount actor,UUID project,UUID record,String event) {
        jdbc.update("INSERT INTO sos.erp_audit(id,project_id,actor_id,record_id,event) VALUES (?,?,?,?,?)",UUID.randomUUID(),project,actor.identityId(),record,event);
    }
    private Map<String,Object> ok(Object id) { return Map.of("status","ok","entity",Map.of("id",id)); }
}
