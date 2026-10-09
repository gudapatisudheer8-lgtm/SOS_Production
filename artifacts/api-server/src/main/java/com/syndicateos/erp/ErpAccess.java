package com.syndicateos.erp;

import com.syndicateos.auth.SessionAccount;
import com.syndicateos.configuration.ConfigurationService;
import com.syndicateos.core.ApiProblem;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Every ERP request revalidates membership, assignment and the configured permission. */
@Service
public class ErpAccess {
    private final JdbcTemplate jdbc;
    private final ConfigurationService config;
    public ErpAccess(JdbcTemplate jdbc,ConfigurationService config) { this.jdbc=jdbc; this.config=config; }
    public Map<String,Object> project(SessionAccount actor,UUID project,String permission,boolean write) {
        return scope(actor,project,permission,write,false);
    }
    public Map<String,Object> attachmentProject(SessionAccount actor,UUID project,String permission,boolean write) {
        return scope(actor,project,permission,write,true);
    }
    private Map<String,Object> scope(SessionAccount actor,UUID project,String permission,boolean write,boolean attachment) {
        actor.business();
        if (!Set.of("ACCOUNTANT","PARTNER").contains(actor.role())) throw ApiProblem.denied();
        List<Map<String,Object>> rows=jdbc.queryForList("""
            SELECT p.*,a.release_id,a.enabled AND s.enabled AS assignment_enabled
            FROM sos.projects p JOIN sos.firms f ON f.id=p.firm_id
            JOIN sos.firm_sector_assignments a ON a.firm_id=p.firm_id AND a.sector_id=p.sector_id
            JOIN sos.sectors s ON s.id=p.sector_id
            WHERE p.id=? AND p.firm_id=? AND f.status='ACTIVE'
            AND EXISTS(SELECT 1 FROM sos.firm_memberships m WHERE m.firm_id=p.firm_id
              AND m.identity_id=? AND m.role_code=? AND m.enabled)
            AND (?='ACCOUNTANT' OR EXISTS(SELECT 1 FROM sos.project_memberships pm
              WHERE pm.project_id=p.id AND pm.identity_id=? AND pm.enabled))
            FOR UPDATE OF p
            """,project,actor.firmId(),actor.identityId(),actor.role(),actor.role(),actor.identityId());
        if (rows.isEmpty()) throw ApiProblem.denied();
        var row=rows.getFirst();
        if (!config.permitted((UUID)row.get("release_id"),actor.role(),permission)
            || write && (!Boolean.TRUE.equals(row.get("assignment_enabled")) || !"ACTIVE".equals(row.get("status"))))
            throw ApiProblem.denied();
        if(!"READY".equals(row.get("setup_state")) && !(attachment&&"ACCOUNTANT".equals(actor.role())))
            throw ApiProblem.invalid("Finalize project setup before entering operational records.");
        return row;
    }
}
