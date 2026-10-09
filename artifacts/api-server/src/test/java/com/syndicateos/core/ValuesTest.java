package com.syndicateos.core;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class ValuesTest {
    @Test void canonicalMobileIdentity() {
        assertEquals("+919888880001",Values.mobile("9888880001"));
        assertEquals("+919888880001",Values.mobile("91 9888880001"));
        assertEquals("+919888880001",Values.mobile("+91-9888880001"));
        assertThrows(ApiProblem.class,()->Values.mobile("not-a-phone"));
    }
    @Test void opaqueCredentialsAndHashes() {
        String first=Values.token(),second=Values.token();
        assertNotEquals(first,second); assertEquals(43,first.length()); assertEquals(64,Values.hash(first).length());
        assertTrue(Values.temporaryCredential().matches("[0-9]{10}"));
        assertThrows(ApiProblem.class,()->Values.credential("short"));
        assertThrows(ApiProblem.class,()->Values.credential("ह".repeat(30))); // bcrypt limit is bytes, not characters.
    }
}
