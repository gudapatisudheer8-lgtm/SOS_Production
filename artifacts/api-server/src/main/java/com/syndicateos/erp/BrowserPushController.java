package com.syndicateos.erp;
import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.auth.SessionAccount;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/browser-push")
public class BrowserPushController {
    private final BrowserPushService service;
    public BrowserPushController(BrowserPushService service) { this.service=service; }
    @GetMapping public Map<String,Object> status(@AuthenticationPrincipal SessionAccount actor) { return service.status(actor); }
    @PostMapping public Map<String,Object> subscribe(@AuthenticationPrincipal SessionAccount actor,@RequestBody JsonNode input) { return service.subscribe(actor,input); }
    @DeleteMapping("/{id}") public Map<String,Object> unsubscribe(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID id) {
        service.unsubscribe(actor,id); return Map.of("status","unsubscribed");
    }
}
