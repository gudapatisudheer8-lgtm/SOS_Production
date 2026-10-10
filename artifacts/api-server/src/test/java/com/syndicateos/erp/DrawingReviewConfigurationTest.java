package com.syndicateos.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DrawingReviewConfigurationTest {
    @Test void independentPartnersMayReviewDrawingsButMayNotManageThem() throws Exception {
        var json=new ObjectMapper();
        var definition=json.readTree("""
            [{"kind":"drawings","title":"Partner Drawings","financial":true,"approvalCount":1,
              "submitRoles":["ACCOUNTANT","PARTNER"],"manageRoles":["ACCOUNTANT"],
              "reviewRoles":["ACCOUNTANT","PARTNER"],
              "fields":[{"key":"amount","label":"Amount","kind":"number","required":true}]}]
            """);
        var config=new ErpConfiguration(null,json);
        assertTrue(config.validate(definition).isEmpty());
        ((com.fasterxml.jackson.databind.node.ObjectNode)definition.get(0))
            .set("manageRoles",json.readTree("[\"PARTNER\"]"));
        assertTrue(config.validate(definition).contains("Invalid resource role capability."));
    }
}
