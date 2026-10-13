package com.syndicateos.erp;
import static org.junit.jupiter.api.Assertions.*;
import java.security.*;
import java.util.Base64;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.interfaces.*;
import org.junit.jupiter.api.Test;
import nl.martijndwars.webpush.*;

class BrowserPushCryptoTest {
    @Test void createsEncryptedStandardWebPushWithVapidWithoutNetwork() throws Exception {
        if(Security.getProvider("BC")==null) Security.addProvider(new BouncyCastleProvider());
        var generator=KeyPairGenerator.getInstance("ECDH","BC");
        generator.initialize(new java.security.spec.ECGenParameterSpec("prime256v1"));
        KeyPair vapid=generator.generateKeyPair(),browser=generator.generateKeyPair();
        assertTrue(Utils.verifyKeyPair(vapid.getPrivate(),vapid.getPublic()));
        assertFalse(Utils.verifyKeyPair(vapid.getPrivate(),browser.getPublic()));
        var encoder=Base64.getUrlEncoder().withoutPadding();
        byte[] auth=new byte[16]; new SecureRandom().nextBytes(auth);
        var payload="{\"title\":\"Registration\",\"tag\":\"stable-test-event\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var notification=new Notification("https://fcm.googleapis.com/fcm/send/synthetic-not-sent",
            encoder.encodeToString(Utils.encode((ECPublicKey)browser.getPublic())),encoder.encodeToString(auth),payload,60);
        var push=new PushService(vapid,"mailto:synthetic@example.invalid");
        var request=push.preparePost(notification,Encoding.AES128GCM);
        assertEquals("aes128gcm",request.getFirstHeader("Content-Encoding").getValue());
        assertTrue(request.getFirstHeader("Authorization").getValue().startsWith("vapid "));
        byte[] encrypted=request.getEntity().getContent().readAllBytes();
        assertFalse(java.util.Arrays.equals(payload,encrypted)); assertTrue(encrypted.length>payload.length);
    }
}
