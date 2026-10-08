package com.syndicateos.health;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

class DatabaseReadinessTest {
    @Test
    void rejectsWrongDatabaseBeforeInspectingAnySchema() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT current_database()", String.class)).thenReturn("another_application");
        var result = new DatabaseReadiness(jdbc, "SOS").inspect();
        assertEquals("DATABASE_TARGET_MISMATCH", result.reason());
        assertFalse(result.targetVerified());
        verify(jdbc, times(1)).queryForObject("SELECT current_database()", String.class);
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void connectionFailureDoesNotExposeCredentialBearingErrors() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT current_database()", String.class))
            .thenThrow(new DataAccessResourceFailureException("sensitive database diagnostics"));
        var result = new DatabaseReadiness(jdbc, "SOS").inspect();
        assertEquals("DATABASE_UNREACHABLE", result.reason());
        assertFalse(result.databaseReachable());
        assertFalse(result.toString().contains("sensitive"));
    }

    @Test
    void emptyTargetIsNotMisrepresentedAsAnOperationalApplication() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT current_database()", String.class)).thenReturn("SOS");
        when(jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'sos'", Integer.class))
            .thenReturn(0);
        var result = new DatabaseReadiness(jdbc, "SOS").inspect();
        assertTrue(result.targetVerified());
        assertEquals("MIGRATIONS_PENDING", result.reason());
        assertEquals("not_ready", result.status());
    }
}
