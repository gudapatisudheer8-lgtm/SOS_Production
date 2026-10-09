package com.syndicateos.health;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.syndicateos.config.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthController.class)
@Import(SecurityConfiguration.class)
class HealthControllerTest {
    @Autowired
    private MockMvc mvc;
    @MockitoBean
    private DatabaseReadiness database;
    @MockitoBean
    private com.syndicateos.auth.AuthService authService;

    @Test
    void livenessDoesNotDependOnRdsAvailability() throws Exception {
        mvc.perform(get("/api/healthz"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void unavailableDatabaseIsNotReportedAsReady() throws Exception {
        when(database.inspect()).thenReturn(
            new DatabaseReadiness.Status("not_ready", false, false, "DATABASE_UNREACHABLE"));
        mvc.perform(get("/api/readyz"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.databaseReachable").value(false));
    }

    @Test
    void configuredApplicationIsReportedAsReady() throws Exception {
        when(database.inspect()).thenReturn(new DatabaseReadiness.Status("ready",true,true,"READY"));
        mvc.perform(get("/api/readyz")).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ready"));
    }

    @Test
    void businessReadsFailClosed() throws Exception {
        mvc.perform(get("/api/firms")).andExpect(status().isUnauthorized());
    }

    @Test
    void businessWritesFailClosed() throws Exception {
        mvc.perform(post("/api/firms")
            .contentType("application/json").content("{\"name\":\"not permitted\"}"))
            .andExpect(status().isUnauthorized());
    }
}
