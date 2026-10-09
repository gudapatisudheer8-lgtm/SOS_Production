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

/** Database-defined forms with trusted financial handlers. Client balances/statuses are never authoritative. */
@Service
public class ErpService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ErpAccess access;
    private final TransactionTemplate tx;
    public ErpService(JdbcTemplate jdbc,ObjectMapper json,ErpAccess access,TransactionTemplate tx) {
        this.jdbc=jdbc; this.json=json; this.access=access; this.tx=tx;
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
        return rows.getFirst();
    }
    public Map<String,Object> read(SessionAccount actor,UUID project) {
        return tx.execute(status -> {
            var scope=access.project(actor,project,"erp.read",false);
            UUID release=(UUID)scope.get("release_id");
            boolean writable=Boolean.TRUE.equals(scope.get("assignment_enabled")) && "ACTIVE".equals(scope.get("status"));
            List<Map<String,Object>> resources=new ArrayList<>();
            for(var r:jdbc.queryForList("SELECT * FROM sos.erp_resources WHERE release_id=? ORDER BY kind",release))
                resources.add(Map.of("kind",r.get("kind"),"title",r.get("title"),"fields",parse(r.get("fields")),
                    "canCreate",writable&&role(r,"submit_roles",actor.role()),"canManage",writable&&role(r,"manage_roles",actor.role()),
                    "canReview",writable&&role(r,"review_roles",actor.role())));
            List<Map<String,Object>> records=new ArrayList<>();
            for(var r:jdbc.queryForList("SELECT * FROM sos.erp_records WHERE project_id=? AND status<>'deleted' ORDER BY created_at DESC",project)) {
                ObjectNode recordData=(ObjectNode)parse(r.get("data"));
                if("PARTNER".equals(actor.role())&&"accounts".equals(r.get("kind"))&&recordData.hasNonNull("accountNumber")) {
                    String number=recordData.path("accountNumber").asText();
                    recordData.put("accountNumber","••••"+number.substring(Math.max(0,number.length()-4)));
                }
                if(Set.of("plots","units").contains(r.get("kind"))&&jdbc.queryForObject(
                    "SELECT count(*) FROM sos.erp_inventory_reservations WHERE inventory_id=? AND state='active'",Integer.class,r.get("id"))>0)
                    recordData.put("status","plots".equals(r.get("kind"))?"reserved":"booked");
                records.add(Map.of("id",r.get("id"),"kind",r.get("kind"),"status",r.get("status"),"revision",r.get("revision"),
                    "createdBy",r.get("created_by"),"createdAt",r.get("created_at").toString(),"data",recordData,
                    "votes",jdbc.queryForList("SELECT actor_id::text FROM sos.erp_approvals WHERE record_id=? AND decision='approved'",String.class,r.get("id"))));
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
            return Map.of("projectId",project,"resources",resources,"records",records,"balances",balances,
                "partners",partners,"audit",audit,"settings",settings,"projectSetup",projectPolicy(release));
        });
    }
    private JsonNode projectPolicy(UUID release) {
        var rows=jdbc.queryForList("SELECT definition FROM sos.project_setup_definitions WHERE release_id=?",release);
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
            SELECT i.id,i.display_name,i.mobile FROM sos.identities i JOIN sos.project_memberships pm ON pm.identity_id=i.id
            JOIN sos.firm_memberships fm ON fm.identity_id=i.id AND fm.firm_id=pm.firm_id AND fm.role_code='PARTNER'
            WHERE pm.project_id=? AND pm.enabled AND fm.enabled AND i.enabled ORDER BY i.display_name
            """,project)) {
            UUID id=(UUID)p.get("id");
            BigDecimal invested=sum(project,id,"investments"),drawings=sum(project,id,"drawings").add(sum(project,id,"stock-draws"));
            BigDecimal expenses=sum(project,id,"expenses");
            BigDecimal equity=BigDecimal.ZERO;
            String split=Objects.toString(settings.get("equitySplitMode"),"fixed").replace("\"","");
            if("proportional".equals(split)) { if(total.signum()>0) equity=invested.multiply(new BigDecimal("100")).divide(total,4,RoundingMode.HALF_UP); }
            else {
                var profiles=jdbc.queryForList("SELECT data FROM sos.erp_records WHERE project_id=? AND kind='partner-profiles' AND partner_id=? AND status='approved'",project,id);
                if(!profiles.isEmpty()) equity=decimal(parse(profiles.getFirst().get("data")).path("fixedEquityPercent"),false);
            }
            partners.add(Map.of("id",id,"name",p.get("display_name"),"mobile",p.get("mobile"),"invested",invested.toPlainString(),
                "drawings",drawings.toPlainString(),"expenses",expenses.toPlainString(),"equityPercent",equity.toPlainString()));
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
            String permission=switch(action) { case "erp.save","erp.bulk-save"->"erp.submit"; case "erp.review"->"erp.review"; default->"erp.manage"; };
            var scope=access.project(actor,project,permission,true);
            UUID release=(UUID)scope.get("release_id");
            if("erp.settings".equals(action)) return updateSettings(actor,project,input);
            if("erp.inventory-stage".equals(action)) return inventoryStage(actor,project,release,input);
            if("erp.save".equals(action)) return save(actor,project,release,input);
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
            if(!"erp.review".equals(action)) throw new ApiProblem(404,"UNKNOWN_COMMAND","Unknown ERP command.");
            return review(actor,project,definition,record,input);
        });
    }
    private Map<String,Object> record(UUID project,UUID id) {
        var rows=jdbc.queryForList("SELECT * FROM sos.erp_records WHERE id=? AND project_id=? AND status<>'deleted' FOR UPDATE",id,project);
        if(rows.isEmpty()) throw ApiProblem.denied();
        return rows.getFirst();
    }
    private boolean posted(UUID id) { return jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE record_id=?",Integer.class,id)>0; }
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
        ObjectNode data=validate(def,input.path("data"));
        UUID id=input.hasNonNull("recordId")?Values.id(input,"recordId"):UUID.randomUUID();
        Map<String,Object> previous=null;
        if(input.hasNonNull("recordId")) {
            previous=record(project,id);
            if(!kind.equals(previous.get("kind")) || !role(def,"manage_roles",actor.role()) || posted(id) && !"accounts".equals(kind)
                || Boolean.TRUE.equals(def.get("financial")) && "approved".equals(previous.get("status"))) throw ApiProblem.denied();
            if(((Integer)previous.get("revision"))!=Values.revision(input)) throw ApiProblem.conflict();
            if("accounts".equals(kind) && decimal(data.path("openingBalance"),false).compareTo(decimal(parse(previous.get("data")).path("openingBalance"),false))!=0)
                throw ApiProblem.invalid("Opening balance is immutable. Record a documented correcting transaction.");
        }
        UUID partner=optionalId(data,"partnerId"),account=optionalId(data,"accountId"),inventory=optionalId(data,"inventoryId");
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
            if(!"available".equals(parse(item.get("data")).path("status").asText())) throw ApiProblem.conflict();
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
                throw ApiProblem.invalid("Customer receipts require an approved booking in this project.");
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
                throw ApiProblem.invalid("Choose an approved individual-paid expense in this project.");
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
                BigDecimal proposed=data.hasNonNull("ratePerSqYard")?decimal(data.path("ratePerSqYard"),true):decimal(inventoryData.path("ratePerSqYard"),true);
                JsonNode details=parse(jdbc.queryForObject("SELECT details::text FROM sos.projects WHERE id=?",String.class,project));
                if(details.hasNonNull("floorRatePerSqYard")&&proposed.compareTo(details.path("floorRatePerSqYard").decimalValue())<0)
                    throw ApiProblem.invalid("This rate is below the protected project floor. A price exception must be approved before booking.");
                data.put("ratePerSqYard",proposed);
                BigDecimal total=proposed.multiply(decimal(inventoryData.path("areaSqYards"),true));
                data.put("totalValue",total);
                if(decimal(data.path("advanceReceived"),false).compareTo(total)>0) throw ApiProblem.invalid("The token exceeds the agreed sale value.");
            }
        }
        if(Set.of("plots","units").contains(kind)) {
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_inventory_reservations WHERE inventory_id=? AND state='active'",Integer.class,id)>0)
                throw ApiProblem.invalid("Inventory with a pending reservation cannot be changed.");
            String numberKey="plots".equals(kind)?"plotNumber":"unitNumber";
            if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND kind=? AND data->>?=? AND status<>'deleted' AND id<>?",
                Integer.class,project,kind,numberKey,data.path(numberKey).asText(),id)>0) throw ApiProblem.invalid("This inventory number already exists in the project.");
            if(previous==null && !"available".equals(data.path("status").asText("available"))) throw ApiProblem.invalid("Create available inventory, then use the booking workflow.");
            if(previous!=null && !parse(previous.get("data")).path("status").asText("available").equals(data.path("status").asText("available")))
                throw ApiProblem.invalid("Inventory status is changed through approved bookings, not direct edits.");
        }
        String state=Boolean.TRUE.equals(def.get("financial")) || "bookings".equals(kind) ? "pending":"approved";
        if(previous==null) jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,partner_id,account_id,inventory_id,status,created_by,request_id)
            VALUES (?,?,?,?,?::jsonb,?::jsonb,?,?,?,?,?,?,?)
            """,id,project,actor.firmId(),kind,data.toString(),input.path("data").toString(),amount,partner,account,inventory,state,actor.identityId(),request);
        else {
            jdbc.update("DELETE FROM sos.erp_approvals WHERE record_id=?",id);
            jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,request_data=?::jsonb,amount=?,partner_id=?,account_id=?,inventory_id=?,status=?,revision=revision+1,request_id=? WHERE id=?",
                data.toString(),input.path("data").toString(),amount,partner,account,inventory,state,request,id);
        }
        if("accounts".equals(kind) && previous==null) {
            BigDecimal opening=decimal(data.path("openingBalance"),false);
            if(opening.signum()>0) { post(id,project,id,"bank",opening,true); post(id,project,null,"opening-capital",opening,false); }
        }
        if("bookings".equals(kind)) {
            jdbc.update("INSERT INTO sos.erp_inventory_reservations(project_id,inventory_id,booking_id,state) VALUES (?,?,?,'active') ON CONFLICT(booking_id) DO UPDATE SET inventory_id=excluded.inventory_id,state='active'",
                project,inventory,id);
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
    private Map<String,Object> review(SessionAccount actor,UUID project,Map<String,Object> definition,Map<String,Object> row,JsonNode input) {
        if(!role(definition,"review_roles",actor.role()) || !"pending".equals(row.get("status"))) throw ApiProblem.denied();
        if(Boolean.TRUE.equals(definition.get("financial")) && (actor.identityId().equals(row.get("created_by")) || actor.identityId().equals(row.get("partner_id"))))
            throw ApiProblem.invalid("You cannot approve your own submission.");
        String decision=Values.text(input,"decision",16);
        if(!Set.of("approved","rejected").contains(decision)) throw ApiProblem.invalid("Choose approved or rejected.");
        String reason=input.path("reason").asText(""); if(reason.length()>1000) throw ApiProblem.invalid("Reason is too long.");
        if("rejected".equals(decision)&&reason.isBlank()) throw ApiProblem.invalid("Provide a rejection reason.");
        UUID id=(UUID)row.get("id");
        if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_approvals WHERE record_id=? AND actor_id=?",Integer.class,id,actor.identityId())>0)
            throw ApiProblem.conflict();
        jdbc.update("INSERT INTO sos.erp_approvals(record_id,actor_id,decision,reason) VALUES (?,?,?,?)",id,actor.identityId(),decision,reason);
        int needed=(Integer)definition.get("approval_count");
        BigDecimal threshold=(BigDecimal)definition.get("approval_threshold");
        if(threshold!=null && ((BigDecimal)row.get("amount")).compareTo(threshold)<=0) needed=1;
        int approvals=jdbc.queryForObject("SELECT count(*) FROM sos.erp_approvals WHERE record_id=? AND decision='approved'",Integer.class,id);
        String state="rejected".equals(decision)?"rejected":approvals>=needed?"approved":"pending";
        if("approved".equals(state)) applyPosting(project,row);
        if("bookings".equals(row.get("kind"))&&!"pending".equals(state))
            jdbc.update("UPDATE sos.erp_inventory_reservations SET state=? WHERE booking_id=?","approved".equals(state)?"cleared":"released",id);
        jdbc.update("UPDATE sos.erp_records SET status=?,revision=revision+1 WHERE id=?",state,id);
        audit(actor,project,id,"REVIEW_"+decision.toUpperCase(Locale.ROOT));
        return Map.of("status","ok","entity",Map.of("id",id,"status",state,"approvals",approvals,"requiredApprovals",needed));
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
            if(!"available".equals(updated.path("status").asText("available"))) throw ApiProblem.conflict();
            updated.put("status","plots".equals(item.get("kind"))?"reserved":"booked");
            for(String key:List.of("buyerName","buyerPhone","advanceReceived","paymentMode","paymentRefNumber"))
                if(data.has(key)) updated.set(key,data.path(key));
            jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",updated.toString(),inventory);
            amount=decimal(data.path("advanceReceived"),false);
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
    private Map<String,Object> inventoryStage(SessionAccount actor,UUID project,UUID release,JsonNode input) {
        if(!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
        UUID id=Values.id(input,"recordId");
        var record=record(project,id);
        if(!Set.of("plots","units").contains(record.get("kind"))||(Integer)record.get("revision")!=Values.revision(input))
            throw ApiProblem.conflict();
        if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=? AND inventory_id=? AND kind='bookings' AND status='approved'",Integer.class,project,id)==0)
            throw ApiProblem.invalid("Approve a customer booking first.");
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
        audit(actor,project,id,"INVENTORY_STAGE_UPDATED");
        return ok(id);
    }
    private void audit(SessionAccount actor,UUID project,UUID record,String event) {
        jdbc.update("INSERT INTO sos.erp_audit(id,project_id,actor_id,record_id,event) VALUES (?,?,?,?,?)",UUID.randomUUID(),project,actor.identityId(),record,event);
    }
    private Map<String,Object> ok(Object id) { return Map.of("status","ok","entity",Map.of("id",id)); }
}
