package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.*;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.configuration.ConfigurationService;
import com.syndicateos.core.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class CommandService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final ConfigurationService config;
    private final WorkspaceReader access;
    private final PasswordEncoder encoder;
    public CommandService(JdbcTemplate jdbc,TransactionTemplate tx,ConfigurationService config,WorkspaceReader access,PasswordEncoder encoder) {
        this.jdbc=jdbc; this.tx=tx; this.config=config; this.access=access; this.encoder=encoder;
    }
    public Map<String,Object> execute(SessionAccount actor,String action,JsonNode input) {
        actor.business();
        if (input==null || !input.isObject() || input.toString().length()>131072) throw ApiProblem.invalid("Supply a bounded command data object.");
        return tx.execute(status -> switch(action) {
            case "firm.create" -> createFirm(actor,input);
            case "firm.update" -> updateFirm(actor,input);
            case "firm.assignSector" -> assign(actor,input);
            case "credentials.reset" -> reset(actor,input);
            case "sector.create" -> createSector(actor,input);
            case "configuration.save" -> config.save(actor,input);
            case "configuration.validate" -> { actor.owner(); var errors=config.validate(config.read(Values.id(input,"releaseId"))); yield Map.of("status",errors.isEmpty()?"valid":"invalid","errors",errors); }
            case "configuration.publish" -> config.publish(actor,input);
            case "project.create" -> createProject(actor,input);
            case "project.update" -> updateProject(actor,input);
            case "partner.add" -> addPartner(actor,input);
            default -> throw new ApiProblem(404,"UNKNOWN_COMMAND","This operation is not supported.");
        });
    }
    private Map<String,Object> createFirm(SessionAccount actor,JsonNode input) {
        actor.owner();
        UUID firm=UUID.randomUUID(); String code=Values.text(input,"clientCode",32).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9-]{3,32}")) throw ApiProblem.invalid("Client code must contain 3–32 uppercase letters, numbers or hyphens.");
        String name=Values.text(input,"name",160);
        if (!input.path("assignments").isArray() || input.path("assignments").isEmpty()) throw ApiProblem.invalid("Assign at least one published sector.");
        jdbc.update("INSERT INTO sos.firms(id,client_code,name,created_by) VALUES (?,?,?,?)",firm,code,name,actor.identityId());
        Map<String,Object> provision=provision(Values.mobile(Values.text(input,"accountantMobile",24)),Values.text(input,"accountantName",120));
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES (?,?,'ACCOUNTANT')",firm,provision.get("id"));
        Set<UUID> unique=new HashSet<>();
        for (JsonNode assignment : input.path("assignments")) {
            UUID sector=Values.id(assignment,"sectorId");
            if (!unique.add(sector)) throw ApiProblem.invalid("A sector may only be assigned once.");
            assignValues(actor,firm,sector,Values.id(assignment,"releaseId"),true);
        }
        config.audit(actor,"FIRM_CREATED",firm,null);
        return Map.of("status","ok","entity",Map.of("id",firm,"clientCode",code,"name",name),"access",provision.get("access"));
    }
    private Map<String,Object> provision(String mobile,String name) {
        // Serialize provisioning for the same phone without a plaintext credential or duplicate identity.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"SOS:identity:"+mobile);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT id,enabled FROM sos.identities WHERE mobile=? FOR UPDATE",mobile);
        if (!rows.isEmpty()) {
            if (jdbc.queryForObject("SELECT count(*) FROM sos.owner_memberships WHERE identity_id=?",Integer.class,rows.getFirst().get("id"))>0)
                throw ApiProblem.invalid("Use a separate mobile number for client access. Owner accounts keep their owner password.");
            if (!Boolean.TRUE.equals(rows.getFirst().get("enabled"))) throw ApiProblem.invalid("This identity is disabled. Contact the product owner.");
            return Map.of("id",rows.getFirst().get("id"),"access",Map.of("mobile",mobile,"reused",true));
        }
        UUID id=UUID.randomUUID(); String temporary=Values.temporaryCredential(); Instant expiry=Instant.now().plus(7,ChronoUnit.DAYS);
        jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,temporary_credential_expires_at) VALUES (?,?,?,?,?)",
            id,mobile,name,encoder.encode(temporary),Timestamp.from(expiry));
        return Map.of("id",id,"access",Map.of("mobile",mobile,"reused",false,"temporaryCredential",temporary,"expiresAt",expiry));
    }
    private Map<String,Object> updateFirm(SessionAccount actor,JsonNode input) {
        actor.owner(); UUID firm=Values.id(input,"firmId"); String state=Values.text(input,"status",20);
        if (!Set.of("ACTIVE","SUSPENDED").contains(state)) throw ApiProblem.invalid("Choose ACTIVE or SUSPENDED.");
        if (jdbc.update("UPDATE sos.firms SET name=?,status=?,revision=revision+1 WHERE id=? AND revision=?",
            Values.text(input,"name",160),state,firm,Values.revision(input))!=1) throw ApiProblem.conflict();
        if ("SUSPENDED".equals(state)) jdbc.update("UPDATE sos.auth_sessions SET revoked_at=now() WHERE firm_id=?",firm);
        config.audit(actor,"FIRM_"+state,firm,null);
        return ok(Map.of("id",firm,"status",state));
    }
    private Map<String,Object> assign(SessionAccount actor,JsonNode input) {
        actor.owner(); UUID firm=Values.id(input,"firmId"),sector=Values.id(input,"sectorId"),release=Values.id(input,"releaseId");
        if (!input.path("enabled").isBoolean()) throw ApiProblem.invalid("An assignment enabled flag is required.");
        if (jdbc.queryForList("SELECT id FROM sos.firms WHERE id=? FOR UPDATE",firm).isEmpty()) throw new ApiProblem(404,"NOT_FOUND","Firm not found.");
        assignValues(actor,firm,sector,release,input.path("enabled").asBoolean());
        return ok(Map.of("firmId",firm,"sectorId",sector,"releaseId",release));
    }
    private void assignValues(SessionAccount actor,UUID firm,UUID sector,UUID release,boolean enabled) {
        if (jdbc.queryForObject("SELECT count(*) FROM sos.sector_releases r JOIN sos.sectors s ON s.id=r.sector_id WHERE r.id=? AND r.sector_id=? AND r.state='PUBLISHED' AND (s.enabled OR NOT ?)",
            Integer.class,release,sector,enabled)==0) throw ApiProblem.invalid("Choose a published release of the required active sector.");
        jdbc.update("INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id,enabled) VALUES (?,?,?,?) ON CONFLICT(firm_id,sector_id) DO UPDATE SET release_id=excluded.release_id,enabled=excluded.enabled",
            firm,sector,release,enabled);
        config.audit(actor,"SECTOR_ASSIGNED",firm,release);
    }
    private Map<String,Object> reset(SessionAccount actor,JsonNode input) {
        actor.owner(); UUID identity=Values.id(input,"identityId");
        if (jdbc.queryForObject("SELECT count(*) FROM sos.owner_memberships WHERE identity_id=?",Integer.class,identity)>0) throw ApiProblem.denied();
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT mobile FROM sos.identities WHERE id=? AND enabled FOR UPDATE",identity);
        if (rows.isEmpty()) throw new ApiProblem(404,"NOT_FOUND","Identity not found.");
        String temporary=Values.temporaryCredential(); Instant expiry=Instant.now().plus(7,ChronoUnit.DAYS);
        jdbc.update("UPDATE sos.identities SET credential_hash=?,must_change_credential=true,temporary_credential_expires_at=?,credential_version=credential_version+1 WHERE id=?",encoder.encode(temporary),Timestamp.from(expiry),identity);
        jdbc.update("UPDATE sos.auth_sessions SET revoked_at=now() WHERE identity_id=?",identity);
        config.audit(actor,"CREDENTIAL_RESET",null,null);
        return Map.of("status","ok","access",Map.of("mobile",rows.getFirst().get("mobile"),"reused",false,"temporaryCredential",temporary,"expiresAt",expiry));
    }
    private Map<String,Object> createSector(SessionAccount actor,JsonNode input) {
        actor.owner(); String code=Values.text(input,"code",64);
        if (!code.matches("[a-z][a-z0-9-]{1,63}")) throw ApiProblem.invalid("Use a lowercase sector code with letters, numbers and hyphens.");
        UUID sector=UUID.randomUUID();
        jdbc.update("INSERT INTO sos.sectors(id,code,name) VALUES (?,?,?)",sector,code,Values.text(input,"name",120));
        config.audit(actor,"SECTOR_CREATED",null,null);
        return ok(Map.of("id",sector,"code",code));
    }
    private Map<String,Object> createProject(SessionAccount actor,JsonNode input) {
        if (!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
        UUID sector=Values.id(input,"sectorId");
        UUID release=access.accountantAccess(actor,actor.firmId(),sector,"projects.write");
        config.validateProject(release,"project.create",input);
        UUID project=UUID.randomUUID();
        jdbc.update("INSERT INTO sos.projects(id,firm_id,sector_id,name,location,details,created_by) VALUES (?,?,?,?,?,?::jsonb,?)",
            project,actor.firmId(),sector,Values.text(input,"name",160),location(input),details(input),actor.identityId());
        config.audit(actor,"PROJECT_CREATED",actor.firmId(),release);
        return ok(Map.of("id",project));
    }
    private Map<String,Object> updateProject(SessionAccount actor,JsonNode input) {
        UUID project=Values.id(input,"projectId");
        Map<String,Object> row=projectForAccountant(actor,project);
        UUID release=access.accountantAccess(actor,(UUID)row.get("firm_id"),(UUID)row.get("sector_id"),"projects.write");
        config.validateProject(release,"project.update",input);
        String state=Values.text(input,"status",20);
        if (!Set.of("ACTIVE","COMPLETED","ARCHIVED").contains(state)) throw ApiProblem.invalid("Choose a valid project status.");
        if (jdbc.update("UPDATE sos.projects SET name=?,location=?,status=?,details=?::jsonb,revision=revision+1 WHERE id=? AND firm_id=? AND revision=?",
            Values.text(input,"name",160),location(input),state,details(input),project,actor.firmId(),Values.revision(input))!=1) throw ApiProblem.conflict();
        config.audit(actor,"PROJECT_UPDATED",actor.firmId(),release);
        return ok(Map.of("id",project));
    }
    private Map<String,Object> addPartner(SessionAccount actor,JsonNode input) {
        UUID project=Values.id(input,"projectId");
        Map<String,Object> row=projectForAccountant(actor,project);
        UUID release=access.accountantAccess(actor,(UUID)row.get("firm_id"),(UUID)row.get("sector_id"),"partners.write");
        config.validatePartner(release,input);
        Map<String,Object> provision=provision(Values.mobile(Values.text(input,"mobile",24)),Values.text(input,"name",120));
        UUID identity=(UUID)provision.get("id");
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES (?,?,'PARTNER') ON CONFLICT(firm_id,identity_id,role_code) DO UPDATE SET enabled=true",actor.firmId(),identity);
        jdbc.update("INSERT INTO sos.project_memberships(project_id,firm_id,identity_id) VALUES (?,?,?) ON CONFLICT(project_id,identity_id) DO UPDATE SET enabled=true",project,actor.firmId(),identity);
        config.audit(actor,"PARTNER_ADDED",actor.firmId(),release);
        return Map.of("status","ok","entity",Map.of("projectId",project,"identityId",identity),"access",provision.get("access"));
    }
    private Map<String,Object> projectForAccountant(SessionAccount actor,UUID project) {
        if (!"ACCOUNTANT".equals(actor.role())) throw ApiProblem.denied();
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT * FROM sos.projects WHERE id=? AND firm_id=? FOR UPDATE",project,actor.firmId());
        if (rows.isEmpty()) throw ApiProblem.denied();
        return rows.getFirst();
    }
    private String location(JsonNode input) {
        JsonNode value=input.get("location");
        if (value==null || value.isNull()) return null;
        if (!value.isTextual() || value.asText().length()>500) throw ApiProblem.invalid("Location must be text of at most 500 characters.");
        return value.asText(); // Blank is not silently converted to a default.
    }
    private String details(JsonNode input) {
        JsonNode details=input.get("details");
        if (details==null) return "{}";
        if (!details.isObject() || details.toString().length()>32000) throw ApiProblem.invalid("Project details must be a bounded object.");
        return details.toString();
    }
    private Map<String,Object> ok(Object entity) { return Map.of("status","ok","entity",entity); }
}
