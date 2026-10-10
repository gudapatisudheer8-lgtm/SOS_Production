package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syndicateos.core.ApiProblem;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UtilityAreaValidationTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final String configuration="""
        [{"key":"layoutAmenities","label":"Utility areas","kind":"rows","required":false,"maxRows":2,
          "fields":[
            {"key":"name","label":"Name","kind":"text","required":true},
            {"key":"allocatedAreaSqYards","label":"Area","kind":"number","required":true,"min":0.000001}
          ]}]
        """;
    @Test void preservesEnteredAreaAndNormalizesName() throws Exception {
        var result=ProjectSetupService.fields(mapper.readTree(configuration),
            mapper.readTree("{\"layoutAmenities\":[{\"name\":\" Sump \",\"allocatedAreaSqYards\":12.5}]}"),true);
        assertEquals("Sump",result.path("layoutAmenities").get(0).path("name").asText());
        assertEquals(12.5,result.path("layoutAmenities").get(0).path("allocatedAreaSqYards").asDouble());
    }
    @Test void rejectsMissingNameZeroNegativeAndUnconfiguredValues() throws Exception {
        var fields=mapper.readTree(configuration);
        for(String row:new String[]{"{\"allocatedAreaSqYards\":12}","{\"name\":\"Sump\",\"allocatedAreaSqYards\":0}",
            "{\"name\":\"Sump\",\"allocatedAreaSqYards\":-2}","{\"name\":\"Sump\",\"allocatedAreaSqYards\":12,\"unknown\":true}"}) {
            var source=mapper.readTree("{\"layoutAmenities\":["+row+"]}");
            assertThrows(ApiProblem.class,()->ProjectSetupService.fields(fields,source,true));
        }
    }
    @Test void rejectsMalformedAndExcessRows() throws Exception {
        var fields=mapper.readTree(configuration);
        for(String rows:new String[]{"{}","[{}, {}, {}]","[\"not a row\"]"}) {
            var source=mapper.readTree("{\"layoutAmenities\":"+rows+"}");
            assertThrows(ApiProblem.class,()->ProjectSetupService.fields(fields,source,true));
        }
    }
}
