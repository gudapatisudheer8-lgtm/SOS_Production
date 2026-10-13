package com.syndicateos.erp;
import static org.junit.jupiter.api.Assertions.*;
import com.syndicateos.core.ApiProblem;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class RegistrationValidationTest {
    @Test void convertsIndiaTimeAndRejectsInvalidOrPastInput() {
        Instant now=Instant.parse("2026-10-13T00:00:00Z");
        assertEquals(Instant.parse("2026-10-14T04:30:00Z"),RegistrationService.appointmentTime("2026-10-14","10:00",now));
        for(String date:new String[]{"2026-02-30","2026-13-01","","2026-10-12"})
            assertThrows(ApiProblem.class,()->RegistrationService.appointmentTime(date,"10:00",now));
        for(String time:new String[]{"24:00","25:30","","10:70","1:00"})
            assertThrows(ApiProblem.class,()->RegistrationService.appointmentTime("2026-10-14",time,now));
    }
    @Test void browserPushCannotTargetArbitraryNetworkAddresses() {
        for(String endpoint:new String[]{"http://fcm.googleapis.com/x","https://localhost/x","https://127.0.0.1/",
            "https://fcm.googleapis.com.evil.test/x","https://user@fcm.googleapis.com/x","https://fcm.googleapis.com:443/x","https://169.254.169.254/"})
            assertThrows(ApiProblem.class,()->BrowserPushService.validateEndpoint(endpoint));
        assertDoesNotThrow(()->BrowserPushService.validateEndpoint("https://fcm.googleapis.com/fcm/send/example"));
        assertDoesNotThrow(()->BrowserPushService.validateEndpoint("https://updates.push.services.mozilla.com/wpush/v2/example"));
        assertDoesNotThrow(()->BrowserPushService.validateEndpoint("https://web.push.apple.com/example"));
    }
}
