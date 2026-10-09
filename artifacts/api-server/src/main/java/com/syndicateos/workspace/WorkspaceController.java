package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.configuration.ConfigurationService;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
    private final WorkspaceReader reader;
    private final CommandService commands;
    private final ConfigurationService config;
    public WorkspaceController(WorkspaceReader reader,CommandService commands,ConfigurationService config) {
        this.reader=reader; this.commands=commands; this.config=config;
    }
    @GetMapping("/workspace") public Map<String,Object> workspace(@AuthenticationPrincipal SessionAccount actor) { return reader.workspace(actor); }
    public record CommandInput(JsonNode data) {}
    @PostMapping("/commands/{action}") public Map<String,Object> command(@AuthenticationPrincipal SessionAccount actor,
        @PathVariable String action,@RequestBody CommandInput input) { return commands.execute(actor,action,input.data()); }
    @GetMapping("/configuration/{releaseId}") public JsonNode configuration(@AuthenticationPrincipal SessionAccount actor,
        @PathVariable UUID releaseId) { actor.owner(); return config.read(releaseId); }
}
