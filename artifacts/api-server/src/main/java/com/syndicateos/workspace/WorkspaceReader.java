package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.configuration.ConfigurationService;
import com.syndicateos.core.ApiProblem;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceReader {
    private final JdbcTemplate jdbc;
    private final ConfigurationService config;
    public WorkspaceReader(JdbcTemplate jdbc, ConfigurationService config) { this.jdbc=jdbc; this.config=config; }

    public Map<String,Object> workspace(SessionAccount actor) {
        actor.business();
        List<Map<String,Object>> firms;
        if ("OWNER".equals(actor.role())) firms=jdbc.queryForList("SELECT * FROM sos.firms ORDER BY created_at DESC");
        else if ("ACCOUNTANT".equals(actor.role())) firms=jdbc.queryForList("SELECT * FROM sos.firms WHERE id=? AND status='ACTIVE'",actor.firmId());
        else firms=jdbc.queryForList("""
            SELECT DISTINCT f.* FROM sos.firms f JOIN sos.project_memberships pm ON pm.firm_id=f.id
            JOIN sos.firm_memberships fm ON fm.firm_id=f.id AND fm.identity_id=pm.identity_id AND fm.role_code='PARTNER'
            WHERE pm.identity_id=? AND f.id=? AND pm.enabled AND fm.enabled AND f.status='ACTIVE' ORDER BY f.created_at DESC
            """,actor.identityId(),actor.firmId());
        List<Map<String,Object>> outputFirms=new ArrayList<>();
        List<Map<String,Object>> interfaces=new ArrayList<>();
        Set<UUID> sectorIds=new HashSet<>();
        for (Map<String,Object> firm : firms) {
            UUID firmId=(UUID)firm.get("id");
            List<Map<String,Object>> accountants = "OWNER".equals(actor.role())
                ? jdbc.queryForList("SELECT i.id AS \"identityId\",i.display_name AS \"displayName\",i.mobile FROM sos.identities i JOIN sos.firm_memberships m ON m.identity_id=i.id WHERE m.firm_id=? AND m.role_code='ACCOUNTANT' AND m.enabled",firmId)
                : List.of();
            outputFirms.add(Map.of("id",firmId,"clientCode",firm.get("client_code"),"name",firm.get("name"),
                "status",firm.get("status"),"revision",firm.get("revision"),"accountants",accountants,
                "metadata",config.parse(firm.get("metadata"))));
            for (Map<String,Object> assignment : jdbc.queryForList(
                "SELECT a.*,s.name,s.enabled AS sector_enabled FROM sos.firm_sector_assignments a JOIN sos.sectors s ON s.id=a.sector_id WHERE a.firm_id=? ORDER BY s.name",firmId)) {
                UUID sector=(UUID)assignment.get("sector_id"), release=(UUID)assignment.get("release_id");
                if ("PARTNER".equals(actor.role()) && !memberSector(actor,firmId,sector)) continue;
                if (!"OWNER".equals(actor.role()) && !config.permitted(release,actor.role(),"projects.read")) continue;
                sectorIds.add(sector);
                ObjectNode manifest=config.read(release);
                if (!"OWNER".equals(actor.role())) {
                    var roleInterfaces=manifest.withArray("interfaces");
                    for (int n=roleInterfaces.size()-1;n>=0;n--) if (!actor.role().equals(roleInterfaces.get(n).path("role").asText())) roleInterfaces.remove(n);
                    var grants=manifest.withArray("grants");
                    for (int n=grants.size()-1;n>=0;n--) if (!actor.role().equals(grants.get(n).path("role").asText())) grants.remove(n);
                }
                interfaces.add(Map.of("firmId",firmId,"sectorId",sector,"releaseId",release,"sectorName",assignment.get("name"),
                    "enabled",Boolean.TRUE.equals(assignment.get("enabled")) && Boolean.TRUE.equals(assignment.get("sector_enabled")),"configuration",manifest));
            }
        }
        List<Map<String,Object>> sectors=new ArrayList<>();
        for (Map<String,Object> sector : jdbc.queryForList("SELECT * FROM sos.sectors ORDER BY name")) {
            UUID id=(UUID)sector.get("id");
            if (!"OWNER".equals(actor.role()) && !sectorIds.contains(id)) continue;
            List<Map<String,Object>> releases="OWNER".equals(actor.role())
                ? jdbc.queryForList("SELECT id,version,revision,state,label FROM sos.sector_releases WHERE sector_id=? ORDER BY version DESC",id) : List.of();
            sectors.add(Map.of("id",id,"code",sector.get("code"),"name",sector.get("name"),"enabled",sector.get("enabled"),"releases",releases));
        }
        List<Map<String,Object>> projects=new ArrayList<>();
        List<Map<String,Object>> rows;
        if ("OWNER".equals(actor.role())) rows=jdbc.queryForList("SELECT * FROM sos.projects ORDER BY created_at DESC");
        else if ("ACCOUNTANT".equals(actor.role())) rows=jdbc.queryForList("""
            SELECT p.* FROM sos.projects p JOIN sos.firms f ON f.id=p.firm_id
            JOIN sos.firm_memberships m ON m.firm_id=f.id
            WHERE f.id=? AND f.status='ACTIVE' AND m.identity_id=? AND m.role_code='ACCOUNTANT' AND m.enabled
            ORDER BY p.created_at DESC
            """,actor.firmId(),actor.identityId());
        else rows=jdbc.queryForList("""
            SELECT p.* FROM sos.projects p JOIN sos.project_memberships pm ON pm.project_id=p.id
            JOIN sos.firms f ON f.id=p.firm_id JOIN sos.firm_memberships fm ON fm.firm_id=f.id AND fm.identity_id=pm.identity_id AND fm.role_code='PARTNER'
            WHERE pm.identity_id=? AND f.id=? AND pm.enabled AND fm.enabled AND f.status='ACTIVE' ORDER BY p.created_at DESC
            """,actor.identityId(),actor.firmId());
        for (Map<String,Object> row : rows) {
            UUID firm=(UUID)row.get("firm_id"), sector=(UUID)row.get("sector_id"), project=(UUID)row.get("id");
            UUID release=jdbc.queryForObject("SELECT release_id FROM sos.firm_sector_assignments WHERE firm_id=? AND sector_id=?",UUID.class,firm,sector);
            if (!"OWNER".equals(actor.role()) && !config.permitted(release,actor.role(),"projects.read")) continue;
            Map<String,Object> item=new LinkedHashMap<>();
            item.put("id",project); item.put("firmId",firm); item.put("sectorId",sector); item.put("name",row.get("name"));
            item.put("location",row.get("location")); item.put("status",row.get("status")); item.put("revision",row.get("revision"));
            item.put("details",config.parse(row.get("details")));
            item.put("setupState",row.get("setup_state"));
            if("PARTNER".equals(actor.role()) && !"READY".equals(row.get("setup_state"))) continue;
            if("ACCOUNTANT".equals(actor.role())) {
                var setup=jdbc.queryForList("SELECT data FROM sos.project_setup_sections WHERE project_id=?",project);
                if(!setup.isEmpty()) item.put("setupData",config.parse(setup.getFirst().get("data")));
                if("READY".equals(row.get("setup_state")) && row.get("setup_release_id")!=null) {
                    item.put("setupReleaseId",row.get("setup_release_id"));
                    var definitions=jdbc.queryForList("SELECT definition FROM sos.project_setup_effective_definitions WHERE release_id=?",row.get("setup_release_id"));
                    if(!definitions.isEmpty()) item.put("setupDefinition",config.parse(definitions.getFirst().get("definition")));
                }
            }
            List<Map<String,Object>> partners=List.of();
            if ("OWNER".equals(actor.role()) || config.permitted(release,actor.role(),"partners.read")) {
                if ("PARTNER".equals(actor.role())) partners=jdbc.queryForList(
                    "SELECT i.id AS \"identityId\",coalesce(pm.display_name,i.display_name) AS \"displayName\",pm.revision,pm.enabled FROM sos.identities i JOIN sos.project_memberships pm ON pm.identity_id=i.id WHERE pm.project_id=? AND pm.enabled AND i.id=?",project,actor.identityId());
                else partners=jdbc.queryForList("""
                    SELECT i.id AS "identityId",coalesce(pm.display_name,i.display_name) AS "displayName",i.mobile,pm.revision,pm.enabled FROM sos.identities i
                    JOIN sos.project_memberships pm ON pm.identity_id=i.id JOIN sos.firm_memberships fm
                    ON fm.firm_id=pm.firm_id AND fm.identity_id=i.id AND fm.role_code='PARTNER'
                    WHERE pm.project_id=? AND fm.enabled AND i.enabled ORDER BY i.display_name
                    """,project);
            }
            item.put("partners",partners); projects.add(item);
        }
        return Map.of("account",actor,"firms",outputFirms,"sectors",sectors,"projects",projects,"interfaces",interfaces);
    }
    private boolean memberSector(SessionAccount actor,UUID firm,UUID sector) {
        return jdbc.queryForObject("SELECT count(*) FROM sos.projects p JOIN sos.project_memberships pm ON pm.project_id=p.id WHERE p.firm_id=? AND p.sector_id=? AND pm.identity_id=? AND pm.enabled",
            Integer.class,firm,sector,actor.identityId())>0;
    }
    public UUID accountantAccess(SessionAccount actor,UUID firm,UUID sector,String permission) {
        actor.business();
        if (!"ACCOUNTANT".equals(actor.role()) || !firm.equals(actor.firmId())) throw ApiProblem.denied();
        List<UUID> releases=jdbc.query("""
            SELECT a.release_id FROM sos.firms f JOIN sos.firm_memberships m ON m.firm_id=f.id
            JOIN sos.firm_sector_assignments a ON a.firm_id=f.id JOIN sos.sectors s ON s.id=a.sector_id
            WHERE f.id=? AND f.status='ACTIVE' AND m.identity_id=? AND m.role_code='ACCOUNTANT' AND m.enabled
            AND a.sector_id=? AND a.enabled AND s.enabled FOR SHARE OF f,m,a,s
            """,(rs,n)->rs.getObject(1,UUID.class),firm,actor.identityId(),sector);
        if (releases.isEmpty() || !config.permitted(releases.getFirst(),actor.role(),permission)) throw ApiProblem.denied();
        return releases.getFirst();
    }
}
