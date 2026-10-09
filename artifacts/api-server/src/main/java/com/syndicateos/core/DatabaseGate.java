package com.syndicateos.core;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseGate {
    private final JdbcTemplate jdbc;
    private final String expected;
    private final boolean enabled;
    public DatabaseGate(JdbcTemplate jdbc, @Value("${sos.database-name}") String expected,
                        @Value("${sos.writes-enabled:false}") boolean enabled) {
        this.jdbc = jdbc; this.expected = expected; this.enabled = enabled;
    }
    public void requireTarget() {
        if (!expected.equals(jdbc.queryForObject("SELECT current_database()", String.class)))
            throw new ApiProblem(503, "DATABASE_TARGET_MISMATCH", "The database does not match the approved SOS target.");
    }
    public void requireReady() {
        if (!enabled) throw new ApiProblem(503, "SETUP_PENDING",
            "Database-backed onboarding has not been enabled. The approved SOS database must be connected and migrated first.");
        requireTarget();
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM sos.owner_memberships)", Boolean.class)))
            throw new ApiProblem(503, "OWNER_SETUP_PENDING", "The product owner has not been provisioned.");
    }
}
