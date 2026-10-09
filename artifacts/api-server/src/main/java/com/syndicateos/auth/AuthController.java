package com.syndicateos.auth;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) { this.auth=auth; }
    @PostMapping("/login") public AuthService.LoginResult login(@RequestBody AuthService.LoginInput input) { return auth.login(input); }
    @GetMapping("/me") public SessionAccount me(@AuthenticationPrincipal SessionAccount account) { return account; }
    public record CredentialInput(String currentCredential, String newCredential) {}
    @PostMapping("/credential") public AuthService.LoginResult change(@AuthenticationPrincipal SessionAccount account,
        @RequestBody CredentialInput input) { return auth.change(account,input.currentCredential(),input.newCredential()); }
    @PostMapping("/logout") public Map<String,String> logout(Authentication account) {
        auth.logout((String)account.getCredentials()); return Map.of("status","ok");
    }
}
