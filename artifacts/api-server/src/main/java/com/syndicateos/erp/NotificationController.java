package com.syndicateos.erp;

import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final JdbcTemplate jdbc;
    private final ErpAccess access;
    public NotificationController(JdbcTemplate jdbc,ErpAccess access) { this.jdbc=jdbc; this.access=access; }
    private List<UUID> authorized(SessionAccount actor) {
        actor.business();
        List<UUID> projects=new ArrayList<>();
        for(UUID id:jdbc.queryForList("SELECT id FROM sos.projects WHERE firm_id=? AND setup_state='READY'",UUID.class,actor.firmId())) {
            try { access.project(actor,id,"erp.read",false); projects.add(id); }
            catch(ApiProblem denied) { if(denied.status!=403 && denied.status!=400) throw denied; }
        }
        return projects;
    }
    @GetMapping
    public Map<String,Object> read(@AuthenticationPrincipal SessionAccount actor) {
        var projects=authorized(actor);
        if(projects.isEmpty()) return Map.of("items",List.of(),"unread",0);
        String placeholders=String.join(",",Collections.nCopies(projects.size(),"?"));
        List<Object> args=new ArrayList<>(); args.add(actor.identityId()); args.addAll(projects);
        var items=jdbc.queryForList("""
            SELECT n.id::text AS id,n.project_id::text AS "projectId",n.title,n.message,n.created_at::text AS "createdAt",
              r.notification_id IS NOT NULL AS read
            FROM sos.project_notifications n LEFT JOIN sos.project_notification_reads r
              ON r.notification_id=n.id AND r.identity_id=?
            WHERE n.project_id IN (
            """+placeholders+") ORDER BY n.created_at DESC,n.id LIMIT 100",args.toArray());
        var unreadArgs=new ArrayList<Object>(); unreadArgs.addAll(projects); unreadArgs.add(actor.identityId());
        long unread=jdbc.queryForObject("SELECT count(*) FROM sos.project_notifications n WHERE n.project_id IN ("+placeholders+
            ") AND NOT EXISTS(SELECT 1 FROM sos.project_notification_reads r WHERE r.notification_id=n.id AND r.identity_id=?)",Long.class,unreadArgs.toArray());
        return Map.of("items",items,"unread",unread);
    }
    @PostMapping("/{id}/read")
    public Map<String,Object> markRead(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID id) {
        var rows=jdbc.queryForList("SELECT project_id FROM sos.project_notifications WHERE id=?",id);
        if(rows.isEmpty()) throw ApiProblem.denied();
        access.project(actor,(UUID)rows.getFirst().get("project_id"),"erp.read",false);
        jdbc.update("INSERT INTO sos.project_notification_reads(notification_id,identity_id) VALUES(?,?) ON CONFLICT DO NOTHING",id,actor.identityId());
        return Map.of("status","ok");
    }
}
