package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Trusted capabilities are code; editable form labels, fields and approval policies are immutable release data. */
@Service
public class ErpConfiguration {
    public static final Set<String> KINDS=Set.of("accounts","transactions","investments","expenses","budgets",
        "partner-profiles","drawings","bookings","documents","plots","units","settlements","stock-draws","reimbursements");
    public static final Set<String> FINANCIAL=Set.of("transactions","investments","expenses","drawings","bookings","settlements","stock-draws","reimbursements");
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public ErpConfiguration(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    public ArrayNode read(UUID release) {
        ArrayNode result=json.createArrayNode();
        for(var r:jdbc.queryForList("SELECT * FROM sos.erp_resources WHERE release_id=? ORDER BY kind",release)) {
            var item=result.addObject().put("kind",r.get("kind").toString()).put("title",r.get("title").toString())
                .put("financial",(Boolean)r.get("financial")).put("approvalCount",(Integer)r.get("approval_count"));
            try {
                item.set("fields",json.readTree(r.get("fields").toString()));
                for(String key:List.of("submit","manage","review"))
                    item.set(key+"Roles",json.valueToTree(((java.sql.Array)r.get(key+"_roles")).getArray()));
                if(r.get("approval_threshold")!=null) item.put("approvalThreshold",(java.math.BigDecimal)r.get("approval_threshold"));
            } catch(Exception e) { throw new IllegalStateException("Invalid ERP resource configuration",e); }
        }
        return result;
    }
    public List<String> validate(JsonNode resources) {
        List<String> errors=new ArrayList<>();
        if(resources.isMissingNode()) return errors; // Older foundation releases have no ERP surfaces.
        if(!resources.isArray()||resources.size()>32) { errors.add("Supply at most 32 resource definitions."); return errors; }
        Set<String> kinds=new HashSet<>();
        for(JsonNode r:resources) {
            String kind=r.path("kind").asText();
            if(!KINDS.contains(kind)||!kinds.add(kind)) errors.add("Unknown or duplicated ERP resource.");
            if(r.path("title").asText().isBlank()||r.path("title").asText().length()>120) errors.add("Each ERP resource needs a bounded title.");
            if(r.path("financial").asBoolean()!=FINANCIAL.contains(kind)) errors.add("Financial resources must retain their trusted posting handler.");
            if(r.path("approvalCount").asInt()<1||r.path("approvalCount").asInt()>10) errors.add("Approval count must be 1–10.");
            if(r.has("approvalThreshold")&&(!r.path("approvalThreshold").isNumber()||r.path("approvalThreshold").decimalValue().signum()<0)) errors.add("Invalid approval threshold.");
            for(String permission:List.of("submit","manage","review")) {
                JsonNode roles=r.path(permission+"Roles");
                if(!roles.isArray()||roles.size()>2) errors.add("Supply explicit resource roles.");
                Set<String> found=new HashSet<>();
                for(JsonNode role:roles) {
                    String code=role.asText();
                    boolean partnerAllowed="submit".equals(permission)?Set.of("investments","expenses","drawings","bookings","reimbursements").contains(kind)
                        :"review".equals(permission)&&Set.of("investments","expenses","bookings","reimbursements").contains(kind);
                    if(!found.add(code)||!"ACCOUNTANT".equals(code)&&!("PARTNER".equals(code)&&partnerAllowed))
                        errors.add("Invalid resource role capability.");
                }
            }
            if(!r.path("fields").isArray()||r.path("fields").isEmpty()||r.path("fields").size()>100) errors.add("Supply 1–100 fields per resource.");
            Set<String> keys=new HashSet<>();
            for(JsonNode f:r.path("fields")) {
                String key=f.path("key").asText();
                if(!key.matches("[a-z][A-Za-z0-9]{0,63}")||!keys.add(key)) errors.add("Field keys must be valid and unique.");
                if(f.path("label").asText().isBlank()||f.path("label").asText().length()>120) errors.add("ERP fields need bounded labels.");
                if(!Set.of("text","multiline","number","date","select","boolean","account","partner","inventory").contains(f.path("kind").asText())) errors.add("Unsupported ERP field type.");
                if(!f.path("required").isBoolean()) errors.add("ERP fields need an explicit required flag.");
                if("select".equals(f.path("kind").asText())&&(!f.path("options").isArray()||f.path("options").isEmpty()||f.path("options").size()>100)) errors.add("Select fields need explicit bounded options.");
                for(String bound:List.of("min","max")) if(f.has(bound)&&(!f.path(bound).isNumber()||f.path(bound).decimalValue().signum()<0)) errors.add("Invalid numeric bound.");
                if(f.has("min")&&f.has("max")&&f.path("min").decimalValue().compareTo(f.path("max").decimalValue())>0) errors.add("Invalid numeric range.");
            }
        }
        return errors;
    }
    public void save(UUID release,JsonNode resources) {
        jdbc.update("DELETE FROM sos.erp_resources WHERE release_id=?",release);
        for(JsonNode r:resources) jdbc.update("""
            INSERT INTO sos.erp_resources(release_id,kind,title,fields,submit_roles,manage_roles,review_roles,financial,approval_count,approval_threshold)
            VALUES (?,?,?,?::jsonb,string_to_array(?,','),string_to_array(?,','),string_to_array(?,','),?,?,?)
            """,release,r.path("kind").asText(),r.path("title").asText(),r.path("fields").toString(),
            roles(r.path("submitRoles")),roles(r.path("manageRoles")),roles(r.path("reviewRoles")),
            FINANCIAL.contains(r.path("kind").asText()),r.path("approvalCount").asInt(),r.has("approvalThreshold")?r.path("approvalThreshold").decimalValue():null);
    }
    private String roles(JsonNode roles) { List<String> values=new ArrayList<>(); roles.forEach(v->values.add(v.asText())); return String.join(",",values); }
}
