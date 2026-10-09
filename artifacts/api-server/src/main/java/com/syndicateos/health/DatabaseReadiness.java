package com.syndicateos.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseReadiness {
    private final JdbcTemplate jdbc;
    private final String expectedDatabase;
    @Value("${sos.writes-enabled:false}")
    private boolean writesEnabled;

    public DatabaseReadiness(JdbcTemplate jdbc, @Value("${sos.database-name}") String expectedDatabase) {
        this.jdbc = jdbc;
        this.expectedDatabase = expectedDatabase;
    }

    public record Status(String status, boolean databaseReachable, boolean targetVerified, String reason) {}

    /**
     * No writes, schema creation, owner bootstrap or repair are performed here.
     * Never return database errors: those can contain usernames or connection data.
     */
    public Status inspect() {
        try {
            String actualDatabase = jdbc.queryForObject("SELECT current_database()", String.class);
            if (!expectedDatabase.equals(actualDatabase)) {
                return new Status("not_ready", true, false, "DATABASE_TARGET_MISMATCH");
            }
            Integer tables = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'sos'", Integer.class);
            if (writesEnabled && tables != null && tables > 0 && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM sos.owner_memberships)", Boolean.class)))
                return new Status("ready",true,true,"READY");
            return new Status("not_ready", true, true,
                tables != null && tables > 0 ? "ONBOARDING_SETUP_PENDING" : "MIGRATIONS_PENDING");
        } catch (DataAccessException exception) {
            return new Status("not_ready", false, false, "DATABASE_UNREACHABLE");
        }
    }
}
