package com.syndicateos.core;

public final class ApiProblem extends RuntimeException {
    public final int status;
    public final String code;
    public ApiProblem(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    public static ApiProblem invalid(String message) {
        return new ApiProblem(400, "VALIDATION_FAILED", message);
    }
    public static ApiProblem denied() {
        return new ApiProblem(403, "ACCESS_DENIED", "You do not have access to this operation.");
    }
    public static ApiProblem conflict() {
        return new ApiProblem(409, "REVISION_CONFLICT", "This record changed. Reload before saving.");
    }
}
