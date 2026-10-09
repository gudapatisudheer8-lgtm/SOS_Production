package com.syndicateos.config;

import com.syndicateos.configuration.ConfigurationService;
import com.syndicateos.core.*;
import javax.sql.DataSource;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Explicit setup operation, never enabled in the workspace/default runtime.
 * Validates the exact target BEFORE any schema creation and never resets data.
 */
@Component
@org.springframework.core.annotation.Order(0)
@ConditionalOnProperty(name="sos.setup-approved",havingValue="true")
public class SchemaSetup implements ApplicationRunner {
    private final DataSource source;
    private final JdbcTemplate jdbc;
    private final DatabaseGate gate;
    private final Environment env;
    private final PasswordEncoder encoder;
    private final TransactionTemplate tx;
    private final ConfigurationService config;
    public SchemaSetup(DataSource source,JdbcTemplate jdbc,DatabaseGate gate,Environment env,
        PasswordEncoder encoder,TransactionTemplate tx,ConfigurationService config) {
        this.source=source;this.jdbc=jdbc;this.gate=gate;this.env=env;this.encoder=encoder;this.tx=tx;this.config=config;
    }
    @Override public void run(ApplicationArguments arguments) {
        gate.requireTarget();
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT current_setting('transaction_read_only')::boolean",Boolean.class)))
            throw new IllegalStateException("Explicit setup requires a writable SOS connection.");
        boolean existing=Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT to_regclass('sos.flyway_schema_history') IS NOT NULL",Boolean.class));
        if(env.getProperty("sos.upgrade-only",Boolean.class,false) &&
            (!existing || jdbc.queryForObject("SELECT count(*) FROM sos.owner_memberships",Integer.class)==0))
            throw new IllegalStateException("Upgrade-only mode requires an existing SOS installation and owner. No initial setup performed.");
        if (!existing && jdbc.queryForObject("""
            SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
            AND c.relkind IN ('r','p','v','m','S','f')
            """,Integer.class)>0)
            throw new IllegalStateException("Initial SOS setup requires the approved empty database. Existing objects found; no migration performed.");
        // Validate initial owner input before migrating, and never include values in errors.
        boolean first=!existing;
        String mobile=first ? Values.mobile(env.getProperty("SOS_OWNER_MOBILE")) : null;
        String password=first ? env.getProperty("SOS_OWNER_INITIAL_PASSWORD") : null;
        if (first) Values.credential(password);
        Flyway.configure().dataSource(source).defaultSchema("sos").schemas("sos").createSchemas(true)
            .cleanDisabled(true).baselineOnMigrate(false).locations("classpath:db/migration").load().migrate();
        tx.executeWithoutResult(status -> {
            for (UUID release : jdbc.query("SELECT id FROM sos.sector_releases",(rs,n)->rs.getObject(1,UUID.class))) {
                var errors=config.validate(config.read(release));
                if (!errors.isEmpty()) throw new IllegalStateException("Seed configuration failed validation: "+String.join("; ",errors));
            }
            if (jdbc.queryForObject("SELECT count(*) FROM sos.owner_memberships",Integer.class)==0) {
                String bootstrapMobile=first ? mobile : Values.mobile(env.getProperty("SOS_OWNER_MOBILE"));
                String bootstrapPassword=first ? password : env.getProperty("SOS_OWNER_INITIAL_PASSWORD");
                Values.credential(bootstrapPassword);
                UUID owner=UUID.randomUUID();
                jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential) VALUES (?,?,'Product owner',?,true)",
                    owner,bootstrapMobile,encoder.encode(bootstrapPassword));
                jdbc.update("INSERT INTO sos.owner_memberships(identity_id) VALUES (?)",owner);
            }
        });
    }
}
