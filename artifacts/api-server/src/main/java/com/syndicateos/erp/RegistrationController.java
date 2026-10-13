package com.syndicateos.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.auth.SessionAccount;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/erp/{project}/plots/{inventory}/registration")
public class RegistrationController {
    private final RegistrationService service;
    public RegistrationController(RegistrationService service) { this.service=service; }
    @GetMapping
    public Map<String,Object> read(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID project,@PathVariable UUID inventory) {
        return service.read(actor,project,inventory);
    }
    @PutMapping
    public Map<String,Object> save(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID project,@PathVariable UUID inventory,@RequestBody JsonNode input) {
        return service.save(actor,project,inventory,input);
    }
}
