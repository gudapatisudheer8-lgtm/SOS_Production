package com.syndicateos.auth;

import java.util.UUID;

public record SessionAccount(UUID identityId, String role, String displayName, String mobile,
                             boolean mustChangeCredential, UUID firmId, String clientCode) {
    public void owner() {
        business();
        if (!"OWNER".equals(role)) throw com.syndicateos.core.ApiProblem.denied();
    }
    public void business() {
        if (mustChangeCredential) throw new com.syndicateos.core.ApiProblem(403,
            "CREDENTIAL_CHANGE_REQUIRED", "Change your temporary credential before accessing business data.");
    }
}
