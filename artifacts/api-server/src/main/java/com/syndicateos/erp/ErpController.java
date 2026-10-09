package com.syndicateos.erp;
import com.syndicateos.auth.SessionAccount;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/erp")
public class ErpController {
    private final ErpService service;
    public ErpController(ErpService service) { this.service=service; }
    @GetMapping("/{projectId}")
    public Map<String,Object> read(@AuthenticationPrincipal SessionAccount actor,@PathVariable UUID projectId) {
        return service.read(actor,projectId);
    }
}
