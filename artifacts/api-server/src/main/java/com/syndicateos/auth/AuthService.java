package com.syndicateos.auth;

import com.syndicateos.core.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final PasswordEncoder encoder;
    private final DatabaseGate gate;
    private final String dummy;
    public AuthService(JdbcTemplate jdbc, TransactionTemplate tx, PasswordEncoder encoder, DatabaseGate gate) {
        this.jdbc = jdbc; this.tx = tx; this.encoder = encoder; this.gate = gate;
        dummy = encoder.encode(Values.token());
    }
    public record LoginInput(String role, String mobile, String credential, String clientCode) {}
    public record LoginResult(String token, Instant expiresAt, SessionAccount account) {}
    public LoginResult login(LoginInput input) {
        gate.requireReady();
        String mobile = Values.mobile(input.mobile());
        if (!Set.of("OWNER", "ACCOUNTANT", "PARTNER").contains(Objects.toString(input.role(), "")))
            throw ApiProblem.invalid("Choose a valid role.");
        if (input.credential() == null || input.credential().length() > 72 || input.credential().isEmpty())
            throw ApiProblem.invalid("A credential is required.");
        String key = Values.hash("login:" + mobile);
        Object result = tx.execute(status -> {
            jdbc.update("INSERT INTO sos.signin_limits(key_hash,window_until) VALUES (?,now()+interval '15 minutes') ON CONFLICT DO NOTHING", key);
            Map<String,Object> limit = jdbc.queryForMap("SELECT failures, window_until < now() AS expired, locked_until > now() AS locked FROM sos.signin_limits WHERE key_hash=? FOR UPDATE", key);
            if (Boolean.TRUE.equals(limit.get("locked")))
                return new ApiProblem(429, "LOGIN_RATE_LIMITED", "Too many attempts. Try again in 15 minutes.");
            if (Boolean.TRUE.equals(limit.get("expired")))
                jdbc.update("UPDATE sos.signin_limits SET failures=0,locked_until=null,window_until=now()+interval '15 minutes' WHERE key_hash=?", key);
            List<Map<String,Object>> rows = jdbc.queryForList("SELECT *, temporary_credential_expires_at < now() AS temporary_expired FROM sos.identities WHERE mobile=? FOR UPDATE", mobile);
            Map<String,Object> identity = rows.isEmpty() ? null : rows.getFirst();
            boolean passwordOk = encoder.matches(input.credential(), identity == null ? dummy : (String)identity.get("credential_hash"));
            UUID firm = null;
            boolean allowed = identity != null && Boolean.TRUE.equals(identity.get("enabled"))
                && !Boolean.TRUE.equals(identity.get("temporary_expired")) && passwordOk;
            if (allowed) {
                UUID id = (UUID)identity.get("id");
                if ("OWNER".equals(input.role())) allowed = exists("SELECT count(*) FROM sos.owner_memberships WHERE identity_id=?", id);
                else if ("ACCOUNTANT".equals(input.role())) {
                    List<UUID> firms = jdbc.query("SELECT f.id FROM sos.firms f JOIN sos.firm_memberships m ON m.firm_id=f.id WHERE upper(f.client_code)=? AND f.status='ACTIVE' AND m.identity_id=? AND m.role_code='ACCOUNTANT' AND m.enabled",
                        (rs,n) -> rs.getObject(1,UUID.class), Objects.toString(input.clientCode(),"").toUpperCase(Locale.ROOT), id);
                    allowed = !firms.isEmpty(); if (allowed) firm = firms.getFirst();
                } else allowed = exists("SELECT count(*) FROM sos.project_memberships p JOIN sos.firms f ON f.id=p.firm_id JOIN sos.firm_memberships m ON m.firm_id=p.firm_id AND m.identity_id=p.identity_id AND m.role_code='PARTNER' WHERE p.identity_id=? AND p.enabled AND m.enabled AND f.status='ACTIVE'", id);
            }
            if (!allowed) {
                jdbc.update("UPDATE sos.signin_limits SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE key_hash=?", key);
                return new ApiProblem(401, "INVALID_CREDENTIALS", "Check your login details or contact your administrator.");
            }
            jdbc.update("DELETE FROM sos.signin_limits WHERE key_hash=?", key);
            return issue((UUID)identity.get("id"), input.role(), firm);
        });
        if (result instanceof ApiProblem error) throw error; // Failure counters commit before throwing.
        return (LoginResult)result;
    }
    private boolean exists(String sql, Object... args) { return jdbc.queryForObject(sql,Integer.class,args) > 0; }
    private LoginResult issue(UUID id, String role, UUID firm) {
        String token = Values.token(); Instant expiry = Instant.now().plus(24,ChronoUnit.HOURS);
        jdbc.update("INSERT INTO sos.auth_sessions(token_hash,identity_id,role_code,firm_id,credential_version,expires_at) SELECT ?,id,?,?,credential_version,? FROM sos.identities WHERE id=?",
            Values.hash(token), role, firm, java.sql.Timestamp.from(expiry), id);
        return new LoginResult(token, expiry, authenticate(token));
    }
    public SessionAccount authenticate(String token) {
        gate.requireReady();
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw unauthenticated();
        List<SessionAccount> rows = jdbc.query("""
            SELECT i.id,i.display_name,i.mobile,i.must_change_credential,s.role_code,s.firm_id,f.client_code
            FROM sos.auth_sessions s JOIN sos.identities i ON i.id=s.identity_id LEFT JOIN sos.firms f ON f.id=s.firm_id
            WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>now() AND i.enabled
            AND s.credential_version=i.credential_version
            AND (i.temporary_credential_expires_at IS NULL OR i.temporary_credential_expires_at>now())
            AND (
              (s.role_code='OWNER' AND EXISTS(SELECT 1 FROM sos.owner_memberships o WHERE o.identity_id=i.id))
              OR (s.role_code='ACCOUNTANT' AND f.status='ACTIVE' AND EXISTS(
                SELECT 1 FROM sos.firm_memberships m WHERE m.firm_id=f.id AND m.identity_id=i.id AND m.role_code=s.role_code AND m.enabled))
              OR (s.role_code='PARTNER' AND EXISTS(
                SELECT 1 FROM sos.project_memberships pm JOIN sos.firms pf ON pf.id=pm.firm_id
                JOIN sos.firm_memberships fm ON fm.firm_id=pm.firm_id AND fm.identity_id=pm.identity_id AND fm.role_code='PARTNER'
                WHERE pm.identity_id=i.id AND pm.enabled AND fm.enabled AND pf.status='ACTIVE'))
            )
            """, (rs,n) -> new SessionAccount(rs.getObject("id",UUID.class),rs.getString("role_code"),
                rs.getString("display_name"),rs.getString("mobile"),rs.getBoolean("must_change_credential"),
                rs.getObject("firm_id",UUID.class),rs.getString("client_code")), Values.hash(token));
        if (rows.isEmpty()) throw unauthenticated();
        return rows.getFirst();
    }
    public LoginResult change(SessionAccount account, String current, String replacement) {
        gate.requireReady(); Values.credential(replacement);
        if (current == null || current.length() > 72) throw ApiProblem.invalid("The current credential is required.");
        return tx.execute(status -> {
            String hash = jdbc.queryForObject("SELECT credential_hash FROM sos.identities WHERE id=? FOR UPDATE", String.class, account.identityId());
            if (!encoder.matches(current, hash)) throw new ApiProblem(401,"INVALID_CREDENTIALS","The current credential is incorrect.");
            if (encoder.matches(replacement, hash)) throw ApiProblem.invalid("Choose a different credential.");
            jdbc.update("UPDATE sos.identities SET credential_hash=?,must_change_credential=false,temporary_credential_expires_at=null,credential_version=credential_version+1 WHERE id=?", encoder.encode(replacement),account.identityId());
            jdbc.update("UPDATE sos.auth_sessions SET revoked_at=now() WHERE identity_id=? AND revoked_at IS NULL", account.identityId());
            return issue(account.identityId(),account.role(),account.firmId());
        });
    }
    public void logout(String token) { jdbc.update("UPDATE sos.auth_sessions SET revoked_at=now() WHERE token_hash=?", Values.hash(token)); }
    private ApiProblem unauthenticated() { return new ApiProblem(401,"AUTHENTICATION_REQUIRED","Sign in again to continue."); }
}
