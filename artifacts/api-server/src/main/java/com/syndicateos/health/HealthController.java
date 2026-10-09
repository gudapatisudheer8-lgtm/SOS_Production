package com.syndicateos.health;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {
    private final DatabaseReadiness database;

    public HealthController(DatabaseReadiness database) {
        this.database = database;
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/readyz")
    public ResponseEntity<DatabaseReadiness.Status> ready() {
        DatabaseReadiness.Status status=database.inspect();
        return ResponseEntity.status("ready".equals(status.status()) ? 200 : 503).body(status);
    }
}
