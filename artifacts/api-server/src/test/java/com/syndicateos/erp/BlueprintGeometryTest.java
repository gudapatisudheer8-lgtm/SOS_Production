package com.syndicateos.erp;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.syndicateos.core.ApiProblem;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BlueprintGeometryTest {
    final ObjectMapper json=new ObjectMapper();
    ObjectNode geometry() throws Exception {
        return (ObjectNode)json.readTree("""
            {"plots":[{"number":"1","facing":"UNKNOWN","points":[{"x":10,"y":10},{"x":30,"y":10},{"x":30,"y":30},{"x":10,"y":30}]}],
             "roads":[{"name":"Main road","widthFeet":null,"points":[{"x":0,"y":32},{"x":100,"y":32},{"x":100,"y":40},{"x":0,"y":40}]}],
             "northDegrees":null,"aspectRatio":1.5,"notes":"Width unreadable; verify source."}
            """);
    }
    @Test void unknownMeasurementsRemainUnknown() throws Exception {
        var g=geometry();assertDoesNotThrow(()->BlueprintGeometry.validate(g,Set.of("1"),true));
        assertTrue(g.path("roads").get(0).path("widthFeet").isNull());assertTrue(g.path("northDegrees").isNull());
    }
    @Test void unmatchedPlotNeedsExplicitPlanOnlyAcknowledgement() throws Exception {
        var g=geometry();assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(g,Set.of(),true));
        ((ObjectNode)g.path("plots").get(0)).put("referenceOnly",true);
        assertDoesNotThrow(()->BlueprintGeometry.validate(g,Set.of(),true));
    }
    @Test void duplicatesBoundsAndZeroAreaAreRejected() throws Exception {
        var g=geometry();((ArrayNode)g.get("plots")).add(g.path("plots").get(0).deepCopy());
        var duplicate=g;assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(duplicate,Set.of("1"),false));
        g=geometry();((ObjectNode)g.path("plots").get(0).path("points").get(0)).put("x",101);
        var outside=g;assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(outside,Set.of("1"),false));
        g=geometry();((ObjectNode)g.path("roads").get(0)).put("widthFeet",0);
        var zero=g;assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(zero,Set.of("1"),true));
    }
    @Test void noConfirmedEmptyModelAndNoInvalidAspect() throws Exception {
        var g=geometry();((ArrayNode)g.get("plots")).removeAll();((ArrayNode)g.get("roads")).removeAll();
        assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(g,Set.of(),true));
        assertDoesNotThrow(()->BlueprintGeometry.validate(g,Set.of(),false));
        g.put("aspectRatio",-1);assertThrows(ApiProblem.class,()->BlueprintGeometry.validate(g,Set.of(),false));
    }
}
