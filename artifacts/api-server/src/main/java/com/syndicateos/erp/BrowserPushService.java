package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.*;
import java.net.URI;
import java.security.Security;
import java.time.*;
import java.util.*;
import nl.martijndwars.webpush.Notification;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class BrowserPushService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ErpAccess access;
    private final TransactionTemplate tx;
    private final DatabaseGate gate;
    private final String publicKey,privateKey,subject;
    private final boolean writes;
    public BrowserPushService(JdbcTemplate jdbc,ObjectMapper json,ErpAccess access,TransactionTemplate tx,DatabaseGate gate,
        @Value("${SOS_WEB_PUSH_PUBLIC_KEY:}") String publicKey,@Value("${SOS_WEB_PUSH_PRIVATE_KEY:}") String privateKey,
        @Value("${SOS_WEB_PUSH_SUBJECT:}") String subject,@Value("${sos.writes-enabled:false}") boolean writes) {
        this.jdbc=jdbc; this.json=json; this.access=access; this.tx=tx; this.gate=gate;
        this.publicKey=publicKey; this.privateKey=privateKey; this.subject=subject; this.writes=writes;
        if(Security.getProvider("BC")==null) Security.addProvider(new BouncyCastleProvider());
    }
    private nl.martijndwars.webpush.PushService sender() throws Exception {
        if(publicKey.isBlank()||privateKey.isBlank()||!subject.matches("(mailto:|https://).+"))
            throw new IllegalStateException("Background push is not configured. The notification bell remains available.");
        var pub=nl.martijndwars.webpush.Utils.loadPublicKey(publicKey);
        var priv=nl.martijndwars.webpush.Utils.loadPrivateKey(privateKey);
        if(!nl.martijndwars.webpush.Utils.verifyKeyPair(priv,pub)) throw new IllegalArgumentException("Invalid push key pair.");
        return new nl.martijndwars.webpush.PushService(publicKey,privateKey,subject);
    }
    public Map<String,Object> status(SessionAccount actor) {
        actor.business();
        if(!Set.of("ACCOUNTANT","PARTNER").contains(actor.role())) throw ApiProblem.denied();
        String error="";
        try { sender(); } catch(Exception e) { error="Background push is missing or has invalid server credentials. The bell remains available."; }
        var subscriptions=jdbc.queryForList("""
            SELECT id::text AS id,enabled,last_error AS "lastError" FROM sos.browser_push_subscriptions
            WHERE identity_id=? AND firm_id=? AND role_code=?
            """,actor.identityId(),actor.firmId(),actor.role());
        return Map.of("configured",error.isEmpty(),"publicKey",error.isEmpty()?publicKey:"","error",error,"subscriptions",subscriptions);
    }
    static void validateEndpoint(String endpoint) {
        try {
            URI uri=URI.create(endpoint);
            String host=Objects.toString(uri.getHost(),"").toLowerCase(Locale.ROOT);
            boolean provider=host.equals("fcm.googleapis.com")||host.equals("updates.push.services.mozilla.com")
                ||host.endsWith(".push.services.mozilla.com")||host.equals("web.push.apple.com")
                ||host.endsWith(".notify.windows.com")||host.equals("wns2-par02p.notify.windows.com");
            if(!"https".equals(uri.getScheme())||uri.getRawUserInfo()!=null||uri.getPort()!=-1||uri.getFragment()!=null||!provider
                ||endpoint.length()>2048) throw new IllegalArgumentException();
        } catch(Exception e) { throw ApiProblem.invalid("This browser's push provider is not supported. The bell remains available."); }
    }
    private static String key(JsonNode input,String name,int length) {
        String value=input.path("keys").path(name).asText();
        try { if(Base64.getUrlDecoder().decode(value).length!=length) throw new IllegalArgumentException(); }
        catch(Exception e) { throw ApiProblem.invalid("Invalid browser push subscription keys."); }
        return value;
    }
    public Map<String,Object> subscribe(SessionAccount actor,JsonNode input) {
        gate.requireReady(); actor.business();
        if(!Set.of("ACCOUNTANT","PARTNER").contains(actor.role())) throw ApiProblem.denied();
        try { sender(); } catch(Exception e) { throw new ApiProblem(503,"PUSH_NOT_CONFIGURED","Background push is not configured; bell notifications remain available."); }
        String endpoint=input.path("endpoint").asText();
        validateEndpoint(endpoint);
        String p256dh=key(input,"p256dh",65),auth=key(input,"auth",16);
        try { nl.martijndwars.webpush.Utils.loadPublicKey(p256dh); }
        catch(Exception e) { throw ApiProblem.invalid("Invalid browser encryption key."); }
        return tx.execute(status -> {
            // Project access isn't needed to subscribe; deliveries always re-check project access.
            if(jdbc.queryForObject("""
                SELECT count(*) FROM sos.firm_memberships fm JOIN sos.firms f ON f.id=fm.firm_id JOIN sos.identities i ON i.id=fm.identity_id
                WHERE fm.firm_id=? AND fm.identity_id=? AND fm.role_code=? AND fm.enabled AND i.enabled AND f.status='ACTIVE'
                """,Integer.class,actor.firmId(),actor.identityId(),actor.role())==0) throw ApiProblem.denied();
            var rows=jdbc.queryForList("SELECT * FROM sos.browser_push_subscriptions WHERE endpoint=? FOR UPDATE",endpoint);
            UUID id=rows.isEmpty()?UUID.randomUUID():(UUID)rows.getFirst().get("id");
            if(rows.isEmpty()&&jdbc.queryForObject("""
                SELECT count(*) FROM sos.browser_push_subscriptions WHERE identity_id=? AND firm_id=? AND enabled
                """,Integer.class,actor.identityId(),actor.firmId())>=10)
                throw ApiProblem.invalid("Ten browsers are already subscribed. Disable alerts on an old browser before adding another.");
            if(!rows.isEmpty()&&(!actor.identityId().equals(rows.getFirst().get("identity_id"))
                ||!actor.firmId().equals(rows.getFirst().get("firm_id"))||!actor.role().equals(rows.getFirst().get("role_code"))))
                throw ApiProblem.invalid("This browser is subscribed to another account. Disable its alerts before switching accounts.");
            jdbc.update("""
                INSERT INTO sos.browser_push_subscriptions(id,identity_id,firm_id,role_code,endpoint,p256dh,auth)
                VALUES(?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,
                enabled=true,last_error='',updated_at=now()
                """,id,actor.identityId(),actor.firmId(),actor.role(),endpoint,p256dh,auth);
            return Map.of("id",id,"status","subscribed");
        });
    }
    public void unsubscribe(SessionAccount actor,UUID id) {
        gate.requireReady(); actor.business();
        tx.executeWithoutResult(status -> {
            var owned=jdbc.queryForList("SELECT id FROM sos.browser_push_subscriptions WHERE id=? AND identity_id=? AND firm_id=? AND role_code=? FOR UPDATE",
                id,actor.identityId(),actor.firmId(),actor.role());
            if(owned.isEmpty()) throw ApiProblem.denied();
            jdbc.update("UPDATE sos.browser_push_deliveries SET state='invalidated' WHERE subscription_id=? AND state='pending'",id);
            // Preserve delivery history while releasing the endpoint's unique binding.
            jdbc.update("UPDATE sos.browser_push_subscriptions SET enabled=false,endpoint=?,p256dh='',auth='' WHERE id=?","disabled:"+id,id);
        });
    }
    @Scheduled(fixedDelayString="${sos.push-poll-ms:15000}",initialDelayString="${sos.push-initial-delay-ms:30000}")
    public void deliver() {
        if(!writes) return;
        gate.requireReady();
        for(var candidate:jdbc.queryForList("""
            SELECT d.notification_id,d.subscription_id,n.project_id FROM sos.browser_push_deliveries d
            JOIN sos.project_notifications n ON n.id=d.notification_id
            WHERE d.state='pending' AND d.next_attempt_at<=now() ORDER BY d.next_attempt_at LIMIT 50
            """)) tx.executeWithoutResult(status -> delivery(candidate));
    }
    private void delivery(Map<String,Object> candidate) {
        UUID project=(UUID)candidate.get("project_id"),nid=(UUID)candidate.get("notification_id"),sid=(UUID)candidate.get("subscription_id");
        // Same lock order as edits/cancellation; cannot send an obsolete payload during a concurrent edit.
        jdbc.queryForList("SELECT id FROM sos.projects WHERE id=? FOR UPDATE",project);
        var rows=jdbc.queryForList("""
            SELECT d.*,n.title,n.message,n.inventory_id,n.invalidated,n.registration_revision,
              s.identity_id,s.firm_id,s.role_code,s.endpoint,s.p256dh,s.auth,s.enabled
            FROM sos.browser_push_deliveries d JOIN sos.project_notifications n ON n.id=d.notification_id
            JOIN sos.browser_push_subscriptions s ON s.id=d.subscription_id
            WHERE d.notification_id=? AND d.subscription_id=? AND d.state='pending' FOR UPDATE OF d,s
            """,nid,sid);
        if(rows.isEmpty()) return;
        var r=rows.getFirst();
        boolean valid=Boolean.TRUE.equals(r.get("enabled"))&&!Boolean.TRUE.equals(r.get("invalidated"))
            &&((java.sql.Timestamp)r.get("expires_at")).toInstant().isAfter(Instant.now());
        if(valid) {
            try { access.project(new SessionAccount((UUID)r.get("identity_id"),r.get("role_code").toString(),"","",false,(UUID)r.get("firm_id"),""),project,"erp.read",false); }
            catch(ApiProblem denied) { valid=false; }
        }
        if(valid && r.get("inventory_id")!=null) {
            var state=jdbc.queryForList("""
                SELECT p.state,p.revision,e.data->>'status' AS inventory_state,e.data->>'paymentMilestone' AS milestone
                FROM sos.plot_registrations p JOIN sos.erp_records e ON e.id=p.inventory_id WHERE p.inventory_id=?
                """,r.get("inventory_id"));
            valid=!state.isEmpty()&&state.getFirst().get("revision").equals(r.get("registration_revision"))
                &&("cancelled".equals(state.getFirst().get("state")) || "scheduled".equals(state.getFirst().get("state"))
                    &&"reserved".equals(state.getFirst().get("inventory_state"))&&!"Registered & Cleared".equals(state.getFirst().get("milestone")));
        }
        if(!valid) { update(nid,sid,"invalidated",(Integer)r.get("attempts"),""); return; }
        int attempts=(Integer)r.get("attempts")+1;
        String error=""; boolean terminal=false;
        try {
            var payload=json.createObjectNode().put("title",r.get("title").toString()).put("body",r.get("message").toString())
                .put("tag","sos-"+nid).put("projectId",project.toString()).put("inventoryId",r.get("inventory_id").toString());
            int ttl=(int)Math.min(3600,Math.max(1,Duration.between(Instant.now(),((java.sql.Timestamp)r.get("expires_at")).toInstant()).toSeconds()));
            var notification=new Notification(r.get("endpoint").toString(),r.get("p256dh").toString(),r.get("auth").toString(),json.writeValueAsBytes(payload),ttl);
            var post=sender().preparePost(notification,nl.martijndwars.webpush.Encoding.AES128GCM);
            var config=RequestConfig.custom().setConnectTimeout(5000).setSocketTimeout(5000).setConnectionRequestTimeout(5000).build();
            try(var client=HttpClients.custom().setDefaultRequestConfig(config).disableRedirectHandling().build();
                var response=client.execute(post)) {
                int code=response.getStatusLine().getStatusCode();
                EntityUtils.consume(response.getEntity());
                if(code>=200&&code<300) {
                    update(nid,sid,"sent",attempts,"");
                    jdbc.update("UPDATE sos.browser_push_subscriptions SET last_error='' WHERE id=?",sid); return;
                }
                error="Push provider returned HTTP "+code+". Bell notification remains available.";
                terminal=code==404||code==410||(code>=400&&code<500&&code!=429);
                if(code==404||code==410) jdbc.update("UPDATE sos.browser_push_subscriptions SET enabled=false WHERE id=?",sid);
            }
        } catch(Exception e) { error="Background push delivery failed. Check server credentials/network and re-enable alerts; the bell remains available."; }
        jdbc.update("UPDATE sos.browser_push_subscriptions SET last_error=? WHERE id=?",error,sid);
        update(nid,sid,terminal||attempts>=5?"failed":"pending",attempts,error);
    }
    private void update(UUID notification,UUID subscription,String state,int attempts,String error) {
        jdbc.update("""
            UPDATE sos.browser_push_deliveries SET state=?,attempts=?,last_error=?,next_attempt_at=now()+(? * interval '1 second')
            WHERE notification_id=? AND subscription_id=?
            """,state,attempts,error,Math.min(900,30*(1<<Math.min(attempts,5))),notification,subscription);
    }
}
