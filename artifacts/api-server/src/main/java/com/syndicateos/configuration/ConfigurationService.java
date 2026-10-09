package com.syndicateos.configuration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Typed, bounded registry. Configuration references trusted capabilities, never executable SQL or scripts. */
@Service
public class ConfigurationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private static final Set<String> COMPONENTS = Set.of("summary","project-list","project-form","partner-list","partner-form","erp-dashboard","erp-resource","erp-equity","erp-layout","erp-pricing","erp-statement","erp-audit","erp-settings","erp-plan");
    private static final Set<String> KINDS = Set.of("text","number","date","select","boolean");
    private static final Set<String> PERMISSIONS = Set.of("projects.read","projects.write","partners.read","partners.write","erp.read","erp.manage","erp.submit","erp.review");
    private static final Map<String,String> ACTION_PERMISSION = Map.of(
        "project.create","projects.write","project.update","projects.write","partner.add","partners.write",
        "erp.save","erp.submit","erp.review","erp.review","erp.delete","erp.manage","erp.settings","erp.manage","erp.bulk-save","erp.submit","erp.inventory-stage","erp.manage");
    private final com.syndicateos.erp.ErpConfiguration erp;
    public ConfigurationService(JdbcTemplate jdbc, ObjectMapper json,com.syndicateos.erp.ErpConfiguration erp) { this.jdbc=jdbc; this.json=json; this.erp=erp; }
    public JsonNode parse(Object value) {
        try { return json.readTree(value.toString()); }
        catch (Exception error) { throw new ApiProblem(503,"INVALID_CONFIGURATION","Stored configuration is invalid."); }
    }
    public ObjectNode read(UUID id) {
        List<Map<String,Object>> releases = jdbc.queryForList("SELECT * FROM sos.sector_releases WHERE id=?",id);
        if (releases.isEmpty()) throw new ApiProblem(404,"NOT_FOUND","Configuration not found.");
        Map<String,Object> row = releases.getFirst();
        ObjectNode root = json.createObjectNode().put("releaseId",id.toString()).put("sectorId",row.get("sector_id").toString())
            .put("version",(Integer)row.get("version")).put("revision",(Integer)row.get("revision"))
            .put("state",(String)row.get("state")).put("label",(String)row.get("label"));
        ArrayNode interfaces = root.putArray("interfaces");
        for (Map<String,Object> ui : jdbc.queryForList("SELECT * FROM sos.sector_interfaces WHERE release_id=? ORDER BY role_code",id)) {
            ObjectNode view = interfaces.addObject().put("role",(String)ui.get("role_code")).put("title",(String)ui.get("title"));
            ArrayNode screens = view.putArray("screens");
            for (Map<String,Object> screen : jdbc.queryForList("SELECT * FROM sos.interface_screens WHERE interface_id=? ORDER BY position,id",ui.get("id"))) {
                ObjectNode page = screens.addObject().put("key",(String)screen.get("key")).put("label",(String)screen.get("label"));
                ArrayNode components = page.putArray("components");
                for (Map<String,Object> component : jdbc.queryForList("SELECT * FROM sos.screen_components WHERE screen_id=? ORDER BY position,id",screen.get("id"))) {
                    ObjectNode widget = components.addObject().put("key",(String)component.get("component_key"));
                    widget.set("props",parse(component.get("props")));
                    ArrayNode fields = widget.putArray("fields");
                    for (Map<String,Object> field : jdbc.queryForList("SELECT d.* FROM sos.form_fields f JOIN sos.field_definitions d ON d.id=f.field_id WHERE f.component_id=? ORDER BY f.position,d.id",component.get("id"))) {
                        ObjectNode item = fields.addObject().put("key",(String)field.get("key")).put("label",(String)field.get("label"))
                            .put("kind",(String)field.get("kind")).put("required",(Boolean)field.get("required"));
                        item.set("constraints",parse(field.get("constraints")));
                        ArrayNode options = item.putArray("options");
                        if (field.get("option_set_id") != null)
                            for (Map<String,Object> option : jdbc.queryForList("SELECT value,label FROM sos.options WHERE option_set_id=? ORDER BY position,id",field.get("option_set_id")))
                                options.addObject().put("value",(String)option.get("value")).put("label",(String)option.get("label"));
                    }
                    ArrayNode actions = widget.putArray("actions");
                    for (Map<String,Object> action : jdbc.queryForList("SELECT action_key,label FROM sos.component_actions WHERE component_id=? ORDER BY action_key",component.get("id")))
                        actions.addObject().put("key",(String)action.get("action_key")).put("label",(String)action.get("label"));
                }
            }
        }
        ArrayNode grants = root.putArray("grants");
        for (Map<String,Object> grant : jdbc.queryForList("SELECT * FROM sos.permission_grants WHERE release_id=? ORDER BY role_code,permission_key",id))
            grants.addObject().put("role",(String)grant.get("role_code")).put("permission",(String)grant.get("permission_key")).put("scope",(String)grant.get("scope"));
        root.set("resources",erp.read(id));
        var setup=jdbc.queryForList("SELECT definition FROM sos.project_setup_definitions WHERE release_id=?",id);
        if(!setup.isEmpty()) {
            ObjectNode definition=(ObjectNode)parse(setup.getFirst().get("definition"));
            definition.put("versionId",id.toString());
            root.set("projectSetup",definition);
        }
        return root;
    }
    public List<String> validate(JsonNode root) {
        List<String> errors = new ArrayList<>();
        errors.addAll(erp.validate(root.path("resources")));
        if(root.hasNonNull("projectSetup")) {
            try {com.syndicateos.workspace.ProjectSetupDefinitions.validate(root.path("projectSetup"));}
            catch(ApiProblem problem) {errors.add(problem.getMessage());}
        }
        if (!root.path("interfaces").isArray() || root.path("interfaces").size()!=2)
            errors.add("Provide exactly one accountant interface and one partner interface.");
        if (!root.path("grants").isArray() || root.path("grants").size()>24) errors.add("Supply at most 24 explicit permission grants.");
        Set<String> grants = new HashSet<>();
        for (JsonNode grant : root.path("grants")) {
            String role=grant.path("role").asText(), permission=grant.path("permission").asText(), scope=grant.path("scope").asText();
            if (!Set.of("ACCOUNTANT","PARTNER").contains(role) || !PERMISSIONS.contains(permission)
                || !("PARTNER".equals(role) ? "MEMBER_PROJECTS".equals(scope) && (permission.endsWith(".read") || Set.of("erp.submit","erp.review").contains(permission)) : "FIRM".equals(scope)))
                errors.add("Invalid role permission or scope: "+role+"/"+permission);
            if (!grants.add(role+":"+permission)) errors.add("Duplicate permission grant.");
        }
        Set<String> roles = new HashSet<>();
        Map<String,String> sharedFields = new HashMap<>();
        int fieldCount=0;
        for (JsonNode ui : root.path("interfaces")) {
            String role=ui.path("role").asText();
            if (!Set.of("ACCOUNTANT","PARTNER").contains(role) || !roles.add(role)) errors.add("Interface roles must be unique accountant/partner roles.");
            if (!validLabel(ui.path("title"),120)) errors.add("Each interface needs a title.");
            if (!ui.path("screens").isArray() || ui.path("screens").isEmpty() || ui.path("screens").size()>12) errors.add("Each interface needs between 1 and 12 screens.");
            Set<String> screenKeys = new HashSet<>();
            for (JsonNode screen : ui.path("screens")) {
                if (!screen.path("key").asText().matches("[a-z][a-z0-9-]{0,63}") || !screenKeys.add(screen.path("key").asText())) errors.add("Screen keys must be valid and unique.");
                if (!validLabel(screen.path("label"),120)) errors.add("Each screen needs a label.");
                if (!screen.path("components").isArray() || screen.path("components").isEmpty() || screen.path("components").size()>8) errors.add("Each screen needs between 1 and 8 supported components.");
                for (JsonNode component : screen.path("components")) {
                    String key=component.path("key").asText();
                    if (!COMPONENTS.contains(key)) errors.add("Unsupported component: "+key);
                    if ("PARTNER".equals(role) && key.endsWith("-form")) errors.add("Partners cannot receive business write forms.");
                    if (!component.path("props").isObject() || component.path("props").toString().length()>4096) errors.add("Component props must be a bounded object.");
                    component.path("props").fieldNames().forEachRemaining(prop -> {
                         if (!Set.of("title","description","emptyMessage","resource").contains(prop)) errors.add("Unsupported component property: "+prop);
                        else if (!component.path("props").path(prop).isTextual()) errors.add("Component text properties must be strings.");
                    });
                    Set<String> fieldKeys = new HashSet<>();
                    for (JsonNode field : component.path("fields")) {
                        fieldCount++;
                        String fieldKey=field.path("key").asText();
                        boolean partnerForm = "partner-form".equals(key);
                        boolean binding = partnerForm ? Set.of("name","mobile").contains(fieldKey)
                            : Set.of("name","location").contains(fieldKey) || fieldKey.matches("details\\.[a-zA-Z][a-zA-Z0-9_]{0,63}");
                        if (!binding || !fieldKeys.add(fieldKey) || !KINDS.contains(field.path("kind").asText())
                            || !validLabel(field.path("label"),120) || !field.path("required").isBoolean()) errors.add("Invalid or duplicate form field: "+fieldKey);
                        if ((Set.of("name","mobile").contains(fieldKey) || "location".equals(fieldKey)) && !"text".equals(field.path("kind").asText()))
                            errors.add("Core name/mobile/location fields must be text.");
                        if (!field.path("constraints").isObject()) errors.add("Field constraints must be an object.");
                        field.path("constraints").fieldNames().forEachRemaining(constraint -> {
                            JsonNode value=field.path("constraints").path(constraint);
                            if (!Set.of("min","max","maxLength").contains(constraint) || !value.isNumber()) errors.add("Unsupported field constraint: "+constraint);
                        });
                        if (field.path("constraints").has("min") && field.path("constraints").has("max")
                            && field.path("constraints").path("min").asDouble()>field.path("constraints").path("max").asDouble()) errors.add("Field minimum exceeds maximum.");
                        if (!field.path("options").isArray() || field.path("options").size()>100) errors.add("Supply bounded field options.");
                        Set<String> options = new HashSet<>();
                        for (JsonNode option : field.path("options"))
                            if (!validLabel(option.path("value"),120) || !validLabel(option.path("label"),120) || !options.add(option.path("value").asText())) errors.add("Invalid or duplicate option.");
                        if ("select".equals(field.path("kind").asText()) && field.path("options").isEmpty()) errors.add("Select fields need options.");
                        String definition=field.toString();
                        String previous=sharedFields.putIfAbsent(key+":"+fieldKey,definition);
                        if (previous!=null && !previous.equals(definition)) errors.add("Shared field definitions must agree within a release: "+fieldKey);
                    }
                    Set<String> actions = new HashSet<>();
                    for (JsonNode action : component.path("actions")) {
                        String actionKey=action.path("key").asText();
                        if (!ACTION_PERMISSION.containsKey(actionKey) || !actions.add(actionKey) || !validLabel(action.path("label"),120)
                            || !grants.contains(role+":"+ACTION_PERMISSION.get(actionKey))) errors.add("Action requires a trusted handler and an explicit role permission: "+actionKey);
                        if (!("project-form".equals(key) && actionKey.startsWith("project.") || "partner-form".equals(key) && "partner.add".equals(actionKey) || key.startsWith("erp-") && actionKey.startsWith("erp.")))
                            errors.add("Action is incompatible with its form component.");
                    }
                    if (key.endsWith("-form") && (actions.isEmpty() || !fieldKeys.contains("name"))) errors.add("Forms need a name field and a supported action.");
                    if ("partner-form".equals(key) && !fieldKeys.contains("mobile")) errors.add("Partner forms need a mobile field.");
                    String readPermission=key.startsWith("erp-") ? "erp.read" : key.startsWith("partner-") ? "partners.read" : "projects.read";
                    if (!grants.contains(role+":"+readPermission)) errors.add("Component lacks its read permission: "+key);
                }
            }
        }
        if (fieldCount>100) errors.add("A release can contain at most 100 form field references.");
        return errors.stream().distinct().toList();
    }
    private boolean validLabel(JsonNode value,int max) { return value.isTextual() && !value.asText().isBlank() && value.asText().length()<=max; }

    public Map<String,Object> save(SessionAccount actor, JsonNode input) {
        actor.owner(); UUID sector=Values.id(input,"sectorId"); String label=Values.text(input,"label",120);
        if (input.toString().length()>131072) throw ApiProblem.invalid("Configuration exceeds the supported size.");
        List<String> errors = validate(input);
        if (!errors.isEmpty()) throw ApiProblem.invalid(String.join(" ",errors));
        if (jdbc.queryForList("SELECT id FROM sos.sectors WHERE id=? FOR UPDATE",sector).isEmpty())
            throw new ApiProblem(404,"NOT_FOUND","Sector not found.");
        UUID release;
        if (input.hasNonNull("releaseId")) {
            release=Values.id(input,"releaseId");
            int count=jdbc.update("UPDATE sos.sector_releases SET label=?,revision=revision+1 WHERE id=? AND sector_id=? AND state='DRAFT' AND revision=?",label,release,sector,Values.revision(input));
            if (count!=1) throw ApiProblem.conflict();
            for (String table : List.of("component_actions","form_fields","options","field_definitions","option_sets","screen_components","interface_screens","sector_interfaces","permission_grants"))
                jdbc.update("DELETE FROM sos."+table+" WHERE release_id=?",release); // Table names are a trusted constant registry.
        } else {
            release=UUID.randomUUID();
            int version=jdbc.queryForObject("SELECT coalesce(max(version),0)+1 FROM sos.sector_releases WHERE sector_id=?",Integer.class,sector);
            jdbc.update("INSERT INTO sos.sector_releases(id,sector_id,version,label,created_by) VALUES (?,?,?,?,?)",release,sector,version,label,actor.identityId());
        }
        erp.save(release,input.path("resources"));
        if(input.has("projectSetup")) {
            com.syndicateos.workspace.ProjectSetupDefinitions.validate(input.path("projectSetup"));
            jdbc.update("DELETE FROM sos.project_setup_definitions WHERE release_id=?",release);
            jdbc.update("INSERT INTO sos.project_setup_definitions(release_id,definition) VALUES (?,?::jsonb)",release,input.path("projectSetup").toString());
        }
        Map<String,UUID> fields=new HashMap<>();
        for (JsonNode ui : input.path("interfaces")) {
            UUID interfaceId=UUID.randomUUID();
            jdbc.update("INSERT INTO sos.sector_interfaces(id,release_id,role_code,title) VALUES (?,?,?,?)",interfaceId,release,ui.path("role").asText(),ui.path("title").asText());
            int screenPosition=0;
            for (JsonNode screen : ui.path("screens")) {
                UUID screenId=UUID.randomUUID();
                jdbc.update("INSERT INTO sos.interface_screens(id,release_id,interface_id,key,label,position) VALUES (?,?,?,?,?,?)",
                    screenId,release,interfaceId,screen.path("key").asText(),screen.path("label").asText(),screenPosition++);
                int componentPosition=0;
                for (JsonNode component : screen.path("components")) {
                    UUID componentId=UUID.randomUUID();
                    jdbc.update("INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position) VALUES (?,?,?,?,?::jsonb,?)",
                        componentId,release,screenId,component.path("key").asText(),component.path("props").toString(),componentPosition++);
                    int fieldPosition=0;
                    for (JsonNode field : component.path("fields")) {
                        String key=field.path("key").asText();
                        String scopedKey=component.path("key").asText()+":"+key;
                        UUID fieldId=fields.get(scopedKey);
                        if (fieldId==null) {
                            fieldId=UUID.randomUUID(); fields.put(scopedKey,fieldId); UUID optionsId=null;
                            if (!field.path("options").isEmpty()) {
                                optionsId=UUID.randomUUID();
                                jdbc.update("INSERT INTO sos.option_sets(id,release_id,key) VALUES (?,?,?)",optionsId,release,scopedKey);
                                int optionPosition=0;
                                for (JsonNode option : field.path("options"))
                                    jdbc.update("INSERT INTO sos.options(id,release_id,option_set_id,value,label,position) VALUES (?,?,?,?,?,?)",
                                        UUID.randomUUID(),release,optionsId,option.path("value").asText(),option.path("label").asText(),optionPosition++);
                            }
                            jdbc.update("INSERT INTO sos.field_definitions(id,release_id,key,label,kind,required,option_set_id,constraints) VALUES (?,?,?,?,?,?,?,?::jsonb)",
                                fieldId,release,key,field.path("label").asText(),field.path("kind").asText(),field.path("required").asBoolean(),optionsId,field.path("constraints").toString());
                        }
                        jdbc.update("INSERT INTO sos.form_fields(release_id,component_id,field_id,position) VALUES (?,?,?,?)",release,componentId,fieldId,fieldPosition++);
                    }
                    for (JsonNode action : component.path("actions"))
                        jdbc.update("INSERT INTO sos.component_actions(release_id,component_id,action_key,label) VALUES (?,?,?,?)",release,componentId,action.path("key").asText(),action.path("label").asText());
                }
            }
        }
        for (JsonNode grant : input.path("grants"))
            jdbc.update("INSERT INTO sos.permission_grants(release_id,role_code,permission_key,scope) VALUES (?,?,?,?)",release,grant.path("role").asText(),grant.path("permission").asText(),grant.path("scope").asText());
        audit(actor,"CONFIGURATION_SAVED",null,release);
        return Map.of("status","ok","entity",read(release));
    }
    public Map<String,Object> publish(SessionAccount actor,JsonNode input) {
        actor.owner(); UUID id=Values.id(input,"releaseId");
        List<Map<String,Object>> locked=jdbc.queryForList("SELECT id FROM sos.sector_releases WHERE id=? AND state='DRAFT' FOR UPDATE",id);
        if (locked.isEmpty()) throw ApiProblem.conflict();
        List<String> errors=validate(read(id));
        if (!errors.isEmpty()) throw ApiProblem.invalid(String.join(" ",errors));
        if (jdbc.update("UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now(),published_by=?,revision=revision+1 WHERE id=? AND revision=?",
            actor.identityId(),id,Values.revision(input))!=1) throw ApiProblem.conflict();
        audit(actor,"CONFIGURATION_PUBLISHED",null,id);
        return Map.of("status","ok","entity",read(id));
    }
    public void audit(SessionAccount actor,String event,UUID firm,UUID release) {
        jdbc.update("INSERT INTO sos.configuration_audit(id,actor_id,event,firm_id,release_id) VALUES (?,?,?,?,?)",
            UUID.randomUUID(),actor.identityId(),event,firm,release);
    }
    public boolean permitted(UUID release,String role,String permission) {
        return jdbc.queryForObject("SELECT count(*) FROM sos.permission_grants WHERE release_id=? AND role_code=? AND permission_key=? AND scope=?",
            Integer.class,release,role,permission,"PARTNER".equals(role)?"MEMBER_PROJECTS":"FIRM")>0;
    }
    public void validateProject(UUID release,String action,JsonNode input) {
        ObjectNode config=read(release); boolean configured=false;
        for (JsonNode ui : config.path("interfaces")) if ("ACCOUNTANT".equals(ui.path("role").asText()))
            for (JsonNode screen : ui.path("screens")) for (JsonNode component : screen.path("components"))
                if ("project-form".equals(component.path("key").asText()))
                    for (JsonNode reference : component.path("actions")) if (action.equals(reference.path("key").asText())) {
                        configured=true; validateFields(component.path("fields"),input);
                    }
        if (!configured) throw ApiProblem.denied();
    }
    public void validatePartner(UUID release,JsonNode input) {
        boolean configured=false;
        for (JsonNode ui : read(release).path("interfaces")) if ("ACCOUNTANT".equals(ui.path("role").asText()))
            for (JsonNode screen : ui.path("screens")) for (JsonNode component : screen.path("components"))
                if ("partner-form".equals(component.path("key").asText()))
                    for (JsonNode reference : component.path("actions")) if ("partner.add".equals(reference.path("key").asText())) {
                        configured=true; validateFields(component.path("fields"),input);
                    }
        if (!configured) throw ApiProblem.denied();
    }
    private void validateFields(JsonNode fields,JsonNode input) {
        Set<String> allowedDetails=new HashSet<>();
        for (JsonNode field : fields) {
            String key=field.path("key").asText();
            JsonNode value;
            if (key.startsWith("details.")) { allowedDetails.add(key.substring(8)); value=input.path("details").path(key.substring(8)); }
            else value=input.path(key);
            boolean absent=value.isMissingNode() || value.isNull() || value.isTextual() && value.asText().isBlank();
            if (absent) { if (field.path("required").asBoolean()) throw ApiProblem.invalid(field.path("label").asText()+" is required."); continue; }
            String kind=field.path("kind").asText(); JsonNode limits=field.path("constraints");
            boolean valid=switch(kind) {
                case "number" -> value.isNumber() && (!limits.has("min") || value.asDouble()>=limits.path("min").asDouble())
                    && (!limits.has("max") || value.asDouble()<=limits.path("max").asDouble());
                case "boolean" -> value.isBoolean();
                case "date" -> {
                    boolean date=false;
                    if (value.isTextual()) try { java.time.LocalDate.parse(value.asText()); date=true; } catch (java.time.DateTimeException ignored) {}
                    yield date;
                }
                case "select" -> { boolean found=false; for (JsonNode option : field.path("options")) if (value.isTextual() && option.path("value").asText().equals(value.asText())) found=true; yield found; }
                default -> value.isTextual() && value.asText().length()<=limits.path("maxLength").asInt(4000);
            };
            if (!valid) throw ApiProblem.invalid("Invalid value for "+field.path("label").asText()+".");
        }
        if (input.path("details").isObject())
            input.path("details").fieldNames().forEachRemaining(key -> { if (!allowedDetails.contains(key)) throw ApiProblem.invalid("Unconfigured project field: "+key); });
    }
}
