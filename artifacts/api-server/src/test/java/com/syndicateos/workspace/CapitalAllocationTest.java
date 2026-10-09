package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syndicateos.core.ApiProblem;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CapitalAllocationTest {
    private final ObjectMapper json=new ObjectMapper();
    private com.fasterxml.jackson.databind.JsonNode node(String value) throws Exception {return json.readTree(value);}
    private com.fasterxml.jackson.databind.JsonNode definition() throws Exception {
        return node("""
            {"rules":{"capitalAllocation":{"mode":"equity-linked","budgetField":"cost","capitalField":"capital","equityField":"equity","totalPercent":100,"currencyScale":2}}}
            """);
    }
    @Test void boundedDraftsAndExactAllocations() throws Exception {
        var def=definition();var values=node("{\"cost\":100000000}");
        assertDoesNotThrow(()->CapitalAllocation.validate(def,values,node("[{\"equity\":40,\"capital\":40000000}]"),false));
        assertThrows(ApiProblem.class,()->CapitalAllocation.validate(def,values,node("[{\"equity\":100,\"capital\":200000000}]"),false));
        assertThrows(ApiProblem.class,()->CapitalAllocation.validate(def,values,node("[{\"equity\":20,\"capital\":40000000}]"),false));
        assertThrows(ApiProblem.class,()->CapitalAllocation.validate(def,values,node("[{\"equity\":60,\"capital\":60000000},{\"equity\":60,\"capital\":60000000}]"),false));
        assertThrows(ApiProblem.class,()->CapitalAllocation.validate(def,values,node("[{\"equity\":40,\"capital\":40000000}]"),true));
        assertDoesNotThrow(()->CapitalAllocation.validate(def,values,node("[{\"equity\":40,\"capital\":40000000},{\"equity\":60,\"capital\":60000000}]"),true));
    }
    @Test void roundingPreservesBudgetAndOldConfigurationRemainsCompatible() throws Exception {
        var def=definition();
        assertDoesNotThrow(()->CapitalAllocation.validate(def,node("{\"cost\":0.03}"),node("[{\"equity\":50,\"capital\":0.02},{\"equity\":50,\"capital\":0.01}]"),true));
        assertDoesNotThrow(()->CapitalAllocation.validate(node("{}"),node("{}"),node("[{\"capital\":999999999}]"),true));
        assertThrows(ApiProblem.class,()->CapitalAllocation.validate(def,node("{\"cost\":100}"),node("[{\"equity\":-1,\"capital\":-1}]"),false));
    }
}
