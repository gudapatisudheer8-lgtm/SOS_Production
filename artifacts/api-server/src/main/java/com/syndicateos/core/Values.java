package com.syndicateos.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;

public final class Values {
    private static final SecureRandom RANDOM = new SecureRandom();
    private Values() {}
    public static String text(JsonNode input, String key, int max) {
        JsonNode node = input.get(key);
        if (node == null || !node.isTextual() || node.asText().isBlank() || node.asText().length() > max)
            throw ApiProblem.invalid("A valid " + key + " is required.");
        return node.asText().trim();
    }
    public static UUID id(JsonNode input, String key) { return UUID.fromString(text(input, key, 36)); }
    public static int revision(JsonNode input) {
        if (!input.path("revision").isIntegralNumber() || input.path("revision").asInt() < 1)
            throw ApiProblem.invalid("A positive revision is required.");
        return input.path("revision").asInt();
    }
    public static String mobile(String input) {
        if (input == null || input.length() > 24) throw ApiProblem.invalid("A valid mobile number is required.");
        String clean = input.replaceAll("[\\s()-]", "");
        if (clean.matches("[6-9][0-9]{9}")) clean = "+91" + clean;
        else if (clean.matches("91[6-9][0-9]{9}")) clean = "+" + clean;
        if (!clean.matches("\\+[1-9][0-9]{7,14}")) throw ApiProblem.invalid("Use an international mobile number, for example +91 followed by 10 digits.");
        return clean;
    }
    public static String hash(String input) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    public static String token() {
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    public static String temporaryCredential() {
        return String.format("%010d", RANDOM.nextLong(10_000_000_000L));
    }
    public static void credential(String value) {
        if (value == null || value.length() < 8 || value.getBytes(StandardCharsets.UTF_8).length > 72)
            throw ApiProblem.invalid("Use at least 8 characters and no more than 72 UTF-8 bytes.");
    }
}
