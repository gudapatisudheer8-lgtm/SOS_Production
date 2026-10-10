package com.syndicateos.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** A server-owned project ledger account; it is not a bank account. */
@Service
public class ProjectCashAccountService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public ProjectCashAccountService(JdbcTemplate jdbc,ObjectMapper json) {
        this.jdbc=jdbc; this.json=json;
    }
    private JsonNode policy() {
        var rows=jdbc.queryForList("SELECT metadata FROM sos.business_masters WHERE group_code='project_account_defaults' AND value_code='standard' AND enabled");
        if(rows.isEmpty()) throw new ApiProblem(409,"CASH_NOT_CONFIGURED","Project account defaults are not configured.");
        try { return json.readTree(rows.getFirst().get("metadata").toString()); }
        catch(Exception e) { throw new ApiProblem(409,"CASH_NOT_CONFIGURED","Project account defaults are invalid."); }
    }
    public UUID ensure(SessionAccount actor,UUID project) {
        var projects=jdbc.queryForList("SELECT firm_id FROM sos.projects WHERE id=? FOR UPDATE",project);
        if(projects.isEmpty() || !projects.getFirst().get("firm_id").equals(actor.firmId())) throw ApiProblem.denied();
        var existing=jdbc.queryForList("SELECT account_record_id FROM sos.project_cash_accounts WHERE project_id=?",project);
        if(!existing.isEmpty()) return (UUID)existing.getFirst().get("account_record_id");
        JsonNode p=policy();
        if(p.path("cashAccountType").asText().isBlank() || p.path("cashAccountName").asText().isBlank())
            throw new ApiProblem(409,"CASH_NOT_CONFIGURED","Configure the cash account type and name.");
        UUID id=UUID.randomUUID();
        ObjectNode data=json.createObjectNode().put("accountName",p.path("cashAccountName").asText())
            .put("accountType",p.path("cashAccountType").asText()).put("status","active").put("openingBalance",0);
        jdbc.update("INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,status,created_by,request_id) VALUES(?,?,?,'accounts',?::jsonb,?::jsonb,0,'approved',?,?)",
            id,project,actor.firmId(),data.toString(),data.toString(),actor.identityId(),UUID.randomUUID());
        jdbc.update("INSERT INTO sos.project_cash_accounts(project_id,account_record_id) VALUES(?,?)",project,id);
        jdbc.update("INSERT INTO sos.erp_audit(id,project_id,record_id,actor_id,event) VALUES(?,?,?,?,'PROJECT_CASH_ACCOUNT_CREATED')",
            UUID.randomUUID(),project,id,actor.identityId());
        return id;
    }
    public boolean isDefault(UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM sos.project_cash_accounts WHERE account_record_id=?",Integer.class,id)>0;
    }
    public ObjectNode route(SessionAccount actor,UUID project,String kind,JsonNode input) {
        if(!input.isObject()) throw ApiProblem.invalid("Supply a record object.");
        ObjectNode data=(ObjectNode)input.deepCopy();
        if("accounts".equals(kind)) return data;
        JsonNode p=policy();
        if("expenses".equals(kind) && "individual".equals(data.path("paymentSource").asText())) return data;
        boolean cash=false;
        for(JsonNode field:p.path("cashModeFields")) for(JsonNode mode:p.path("cashPaymentModes"))
            if(mode.asText().equals(data.path(field.asText()).asText())) {
                cash=true;
                data.put(field.asText(),p.path("cashCanonicalMode").asText());
            }
        if(cash) {
            if(data.hasNonNull("accountId") && !data.path("accountId").asText().isBlank()) {
                UUID supplied;
                try { supplied=UUID.fromString(data.path("accountId").asText()); }
                catch(Exception e) { throw ApiProblem.invalid("Choose a valid project account."); }
                if(jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE id=? AND project_id=? AND kind='accounts' AND status='approved'",Integer.class,supplied,project)==0)
                    throw ApiProblem.denied();
            }
            data.put("accountId",ensure(actor,project).toString());
        } else if(data.hasNonNull("accountId") && !data.path("accountId").asText().isBlank()) {
            boolean hasMode=false;
            for(JsonNode field:p.path("cashModeFields")) if(!data.path(field.asText()).asText().isBlank()) hasMode=true;
            UUID supplied;
            try { supplied=UUID.fromString(data.path("accountId").asText()); }
            catch(Exception e) { throw ApiProblem.invalid("Choose a valid project account."); }
            if(hasMode && isDefault(supplied))
                throw ApiProblem.invalid("Use Cash mode for the project cash account. Select a project bank account for non-cash payments.");
        }
        return data;
    }
}
