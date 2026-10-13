package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Project-locked, durable, non-financial registration scheduling. */
@Service
@EnableScheduling
public class RegistrationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ErpAccess access;
    private final TransactionTemplate tx;
    private final DatabaseGate gate;
    private final boolean writes;
    public RegistrationService(JdbcTemplate jdbc,ObjectMapper json,ErpAccess access,TransactionTemplate tx,DatabaseGate gate,
        @Value("${sos.writes-enabled:false}") boolean writes) {
        this.jdbc=jdbc; this.json=json; this.access=access; this.tx=tx; this.gate=gate; this.writes=writes;
    }
    private JsonNode parse(Object value) {
        try { return json.readTree(value.toString()); }
        catch(Exception e) { throw new IllegalStateException("Invalid registration metadata",e); }
    }
    static UUID stable(String key) { return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)); }
    public Map<String,Object> policy() {
        var row=jdbc.queryForMap("SELECT * FROM sos.registration_policy WHERE singleton");
        return Map.of("timezone",row.get("timezone"),"defaultReminderMinutes",parse(row.get("default_reminder_minutes")),
            "maxReminderMinutes",row.get("max_reminder_minutes"),"maxReminders",row.get("max_reminders"),"maxLocationLength",row.get("max_location_length"));
    }
    private Map<String,Object> inventory(UUID project,UUID inventory) {
        var rows=jdbc.queryForList("SELECT * FROM sos.erp_records WHERE id=? AND project_id=? AND kind='plots' AND status='approved'",inventory,project);
        if(rows.isEmpty()) throw ApiProblem.denied();
        return rows.getFirst();
    }
    public Map<String,Object> read(SessionAccount actor,UUID project,UUID inventory) {
        access.project(actor,project,"erp.read",false);
        inventory(project,inventory);
        return Map.of("appointment",readSaved(inventory),"policy",policy());
    }
    private JsonNode readSaved(UUID inventory) {
        var rows=jdbc.queryForList("SELECT * FROM sos.plot_registrations WHERE inventory_id=?",inventory);
        if(rows.isEmpty()) return json.createObjectNode().put("revision",0).put("state","none");
        var r=rows.getFirst();
        var out=json.createObjectNode().put("revision",(Integer)r.get("revision")).put("state",r.get("state").toString())
            .put("timezone","Asia/Kolkata").put("location",r.get("location").toString());
        out.set("reminderMinutes",parse(r.get("reminder_minutes")));
        if(r.get("starts_at")!=null) {
            var date=((java.sql.Timestamp)r.get("starts_at")).toInstant().atZone(ZoneId.of("Asia/Kolkata"));
            out.put("startsAt",date.toInstant().toString()).put("date",date.toLocalDate().toString())
                .put("time",date.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")));
        }
        return out;
    }
    static Instant appointmentTime(String date,String time,Instant now) {
        try {
            if(!date.matches("\\d{4}-\\d{2}-\\d{2}")||!time.matches("\\d{2}:\\d{2}")) throw new IllegalArgumentException();
            Instant starts=LocalDateTime.of(LocalDate.parse(date),LocalTime.parse(time)).atZone(ZoneId.of("Asia/Kolkata")).toInstant();
            if(!starts.isAfter(now)) throw new IllegalArgumentException();
            return starts;
        } catch(Exception e) { throw ApiProblem.invalid("Choose a valid future registration date and time in India (Asia/Kolkata)."); }
    }
    public Map<String,Object> save(SessionAccount actor,UUID project,UUID inventory,JsonNode input) {
        gate.requireReady();
        return tx.execute(status -> {
            var scope=access.project(actor,project,"erp.submit",true);
            // Apply the same configured booking submit roles, not inventory management roles.
            var allowed=jdbc.queryForList("SELECT 1 FROM sos.erp_resources WHERE release_id=? AND kind='bookings' AND ?=ANY(submit_roles)",
                scope.get("release_id"),actor.role());
            if(allowed.isEmpty()) throw ApiProblem.denied();
            var item=inventory(project,inventory);
            UUID request=Values.id(input,"requestId");
            var prior=jdbc.queryForList("SELECT input,result FROM sos.registration_requests WHERE project_id=? AND actor_id=? AND request_id=?",
                project,actor.identityId(),request);
            ObjectNode fingerprint=json.createObjectNode().put("inventoryId",inventory.toString());
            fingerprint.set("input",input);
            if(!prior.isEmpty()) {
                if(!parse(prior.getFirst().get("input")).equals(fingerprint)) throw ApiProblem.conflict();
                return Map.of("appointment",parse(prior.getFirst().get("result")));
            }
            JsonNode old=readSaved(inventory);
            if(!input.path("revision").isIntegralNumber()||!input.path("revision").canConvertToInt()
                ||input.path("revision").asInt()!=old.path("revision").asInt()) throw ApiProblem.conflict();
            String action=input.path("action").asText();
            if(!Set.of("save","cancel").contains(action)) throw ApiProblem.invalid("Choose save or cancel.");
            if("cancel".equals(action)&&!"scheduled".equals(old.path("state").asText())) throw ApiProblem.invalid("There is no scheduled slot to cancel.");
            JsonNode data=parse(item.get("data"));
            Instant now=Instant.now(),starts=null;
            String location="";
            JsonNode leads=json.createArrayNode();
            if("save".equals(action)) {
                if("completed".equals(old.path("state").asText())||!"reserved".equals(data.path("status").asText())||"Registered & Cleared".equals(data.path("paymentMilestone").asText())
                    ||new BookingPayments(jdbc,json).active(project,inventory)==null)
                    throw ApiProblem.invalid("Record the customer booking first. Only an active, uncompleted plot booking can schedule registration.");
                starts=appointmentTime(input.path("date").asText(),input.path("time").asText(),now);
                var policy=policy();
                location=input.path("location").asText().trim();
                if(location.isBlank()||location.length()>(Integer)policy.get("maxLocationLength")||location.chars().anyMatch(Character::isISOControl))
                    throw ApiProblem.invalid("Enter a registration location (maximum "+policy.get("maxLocationLength")+" characters).");
                leads=input.path("reminderMinutes");
                if(!leads.isArray()||leads.size()>(Integer)policy.get("maxReminders")) throw ApiProblem.invalid("Choose valid reminder lead times.");
                Set<Integer> unique=new HashSet<>();
                for(var lead:leads) if(!lead.isIntegralNumber()||!lead.canConvertToInt()||lead.asInt()<=0||lead.asInt()>(Integer)policy.get("maxReminderMinutes")||!unique.add(lead.asInt()))
                    throw ApiProblem.invalid("Reminder minutes must be unique positive whole numbers within the configured limit.");
            } else {
                location=old.path("location").asText(); leads=old.path("reminderMinutes");
                if(old.has("startsAt")) starts=Instant.parse(old.path("startsAt").asText());
            }
            int revision=old.path("revision").asInt()+1;
            invalidate(jdbc,inventory,"cancelled");
            jdbc.update("""
                INSERT INTO sos.plot_registrations(inventory_id,project_id,revision,state,starts_at,location,reminder_minutes,updated_by)
                VALUES(?,?,?,?,?,?,?::jsonb,?) ON CONFLICT(inventory_id) DO UPDATE SET revision=excluded.revision,
                state=excluded.state,starts_at=excluded.starts_at,location=excluded.location,reminder_minutes=excluded.reminder_minutes,
                updated_by=excluded.updated_by,updated_at=now()
                """,inventory,project,revision,"save".equals(action)?"scheduled":"cancelled",starts==null?null:java.sql.Timestamp.from(starts),location,leads.toString(),actor.identityId());
            if("save".equals(action)) for(var lead:leads) {
                Instant due=starts.minusSeconds(lead.asLong()*60);
                if(due.isAfter(now)) jdbc.update("INSERT INTO sos.registration_jobs(id,inventory_id,revision,lead_minutes,due_at) VALUES(?,?,?,?,?)",
                    stable(inventory+":"+revision+":"+lead.asInt()),inventory,revision,lead.asInt(),java.sql.Timestamp.from(due));
            }
            if("save".equals(action)) {
                ObjectNode metadata=(ObjectNode)data.deepCopy();
                metadata.put("paymentMilestone","Registration Pending");
                jdbc.update("UPDATE sos.erp_records SET data=?::jsonb,revision=revision+1 WHERE id=?",metadata.toString(),inventory);
            }
            emit(project,inventory,revision,actor.identityId(),stable(inventory+":"+revision+":schedule"),
                "cancel".equals(action)?"Registration cancelled":old.path("revision").asInt()==0?"Registration scheduled":"Registration updated",
                starts,location,data,now.plusSeconds(86400));
            JsonNode result=readSaved(inventory);
            jdbc.update("INSERT INTO sos.registration_requests VALUES(?,?,?,?::jsonb,?::jsonb)",project,actor.identityId(),request,fingerprint.toString(),result.toString());
            return Map.of("appointment",result);
        });
    }
    /** Called under the existing project write lock by release/completion paths. */
    static void invalidate(JdbcTemplate jdbc,UUID inventory,String state) {
        jdbc.update("UPDATE sos.plot_registrations SET state=?,updated_at=now() WHERE inventory_id=? AND state='scheduled'",state,inventory);
        jdbc.update("UPDATE sos.registration_jobs SET state='invalidated' WHERE inventory_id=? AND state='pending'",inventory);
        jdbc.update("UPDATE sos.project_notifications SET invalidated=true WHERE inventory_id=? AND registration_revision IS NOT NULL",inventory);
        jdbc.update("""
            UPDATE sos.browser_push_deliveries d SET state='invalidated' FROM sos.project_notifications n
            WHERE d.notification_id=n.id AND n.inventory_id=? AND d.state='pending'
            """,inventory);
    }
    private void emit(UUID project,UUID inventory,int revision,UUID actor,UUID event,String title,Instant starts,String location,JsonNode data,Instant expires) {
        String name=jdbc.queryForObject("SELECT name FROM sos.projects WHERE id=?",String.class,project);
        String date=starts==null?"":DateTimeFormatter.ofPattern("dd MMM uuuu, hh:mm a 'IST (Asia/Kolkata)'",Locale.ENGLISH).withZone(ZoneId.of("Asia/Kolkata")).format(starts);
        String message=name+" · "+data.path("plotNumber").asText()+" · "+date+" · "+location;
        for(var recipient:recipients(project)) {
            UUID identity=(UUID)recipient.get("identity_id"),notification=stable(event+":"+identity);
            jdbc.update("""
                INSERT INTO sos.project_notifications(id,project_id,record_id,actor_id,title,message,recipient_id,inventory_id,registration_revision)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING
                """,notification,project,inventory,actor,title,message,identity,inventory,revision);
            jdbc.update("""
                INSERT INTO sos.browser_push_deliveries(notification_id,subscription_id,expires_at)
                SELECT ?,s.id,? FROM sos.browser_push_subscriptions s JOIN sos.projects p ON p.id=?
                WHERE s.identity_id=? AND s.firm_id=p.firm_id AND s.enabled
                AND s.role_code=? ON CONFLICT DO NOTHING
                """,notification,java.sql.Timestamp.from(expires),project,identity,recipient.get("role_code"));
        }
    }
    List<Map<String,Object>> recipients(UUID project) {
        return jdbc.queryForList("""
            SELECT DISTINCT fm.identity_id,fm.role_code FROM sos.firm_memberships fm JOIN sos.projects p ON p.firm_id=fm.firm_id
            JOIN sos.identities i ON i.id=fm.identity_id
            WHERE p.id=? AND fm.enabled AND i.enabled AND
            (fm.role_code='ACCOUNTANT' OR (fm.role_code='PARTNER' AND EXISTS(
              SELECT 1 FROM sos.project_memberships pm WHERE pm.project_id=p.id AND pm.identity_id=fm.identity_id AND pm.enabled)))
            """,project);
    }
    @Scheduled(fixedDelayString="${sos.registration-poll-ms:15000}",initialDelayString="${sos.registration-initial-delay-ms:30000}")
    public void reminders() {
        if(!writes) return;
        gate.requireReady();
        for(var candidate:jdbc.queryForList("""
            SELECT j.id,r.project_id FROM sos.registration_jobs j JOIN sos.plot_registrations r ON r.inventory_id=j.inventory_id
            WHERE j.state='pending' AND j.due_at<=now() ORDER BY j.due_at LIMIT 100
            """)) {
            tx.executeWithoutResult(status -> {
                UUID project=(UUID)candidate.get("project_id");
                jdbc.queryForList("SELECT id FROM sos.projects WHERE id=? FOR UPDATE",project);
                var rows=jdbc.queryForList("""
                    SELECT j.*,r.state AS appointment_state,r.revision AS current_revision,r.starts_at,r.location,r.updated_by
                    FROM sos.registration_jobs j JOIN sos.plot_registrations r ON r.inventory_id=j.inventory_id
                    WHERE j.id=? AND j.state='pending' FOR UPDATE OF j
                    """,candidate.get("id"));
                if(rows.isEmpty()) return;
                var r=rows.getFirst(); UUID inventory=(UUID)r.get("inventory_id");
                var items=jdbc.queryForList("SELECT data,status FROM sos.erp_records WHERE id=?",inventory);
                Instant starts=((java.sql.Timestamp)r.get("starts_at")).toInstant();
                if(items.isEmpty()||!"approved".equals(items.getFirst().get("status"))||!"reserved".equals(parse(items.getFirst().get("data")).path("status").asText())
                    ||"Registered & Cleared".equals(parse(items.getFirst().get("data")).path("paymentMilestone").asText())
                    ||!"scheduled".equals(r.get("appointment_state"))||!r.get("revision").equals(r.get("current_revision"))||!starts.isAfter(Instant.now())
                    ||new BookingPayments(jdbc,json).active(project,inventory)==null) {
                    jdbc.update("UPDATE sos.registration_jobs SET state='invalidated' WHERE id=?",r.get("id")); return;
                }
                emit(project,inventory,(Integer)r.get("revision"),(UUID)r.get("updated_by"),(UUID)r.get("id"),
                    "Registration reminder ("+r.get("lead_minutes")+" minutes before)",starts,r.get("location").toString(),parse(items.getFirst().get("data")),starts);
                jdbc.update("UPDATE sos.registration_jobs SET state='sent' WHERE id=?",r.get("id"));
            });
        }
    }
}
