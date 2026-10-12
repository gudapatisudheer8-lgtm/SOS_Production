package com.syndicateos.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.core.ApiProblem;
import java.util.*;

/** A visual coordinate draft, never a source of financial quantities or survey dimensions. */
public final class BlueprintGeometry {
    private BlueprintGeometry() {}
    public static void validate(JsonNode g,Set<String> inventory,boolean confirm) {
        if(!g.isObject()||g.toString().length()>1_000_000) throw ApiProblem.invalid("Supply a bounded layout geometry.");
        JsonNode plots=g.path("plots"),roads=g.path("roads");
        if(!plots.isArray()||!roads.isArray()||plots.size()>2000||roads.size()>500)
            throw ApiProblem.invalid("Supply plot and road polygon arrays.");
        if(confirm && plots.isEmpty()&&roads.isEmpty()) throw ApiProblem.invalid("Confirm at least one reviewed plot or road.");
        optionalNumber(g.get("northDegrees"),0,Math.nextDown(360d),"north direction");
        optionalNumber(g.get("aspectRatio"),Math.nextUp(0.05),20,"source page aspect ratio");
        if((g.hasNonNull("notes")&&!g.path("notes").isTextual())||g.path("notes").asText().length()>8000) throw ApiProblem.invalid("Supply plain-text layout notes, at most 8000 characters.");
        Set<String> numbers=new HashSet<>();
        for(JsonNode p:plots) {
            String number=p.path("number").asText("").trim();
            if(!p.path("number").isTextual()||number.isEmpty()||number.length()>80||!numbers.add(number.toLowerCase(Locale.ROOT)))
                throw ApiProblem.invalid("Plot labels must be non-empty and unique.");
            if(p.has("referenceOnly")&&!p.path("referenceOnly").isBoolean()) throw ApiProblem.invalid("Plan-only must be an explicit checkbox value.");
            if(!Set.of("E","N","W","S","NE","NW","SE","SW","UNKNOWN").contains(p.path("facing").asText()))
                throw ApiProblem.invalid("Select a known facing or UNKNOWN.");
            polygon(p.path("points")); optionalNumber(p.get("confidence"),0,1,"confidence");
            if(confirm&&!inventory.contains(number)&&!p.path("referenceOnly").asBoolean(false))
                throw ApiProblem.invalid("Plot "+number+" is not in live inventory. Correct its label or explicitly mark it plan-only.");
        }
        for(JsonNode r:roads) {
            if((r.hasNonNull("name")&&!r.path("name").isTextual())||r.path("name").asText().length()>160) throw ApiProblem.invalid("Supply a short plain-text road label.");
            optionalNumber(r.get("widthFeet"),0.01,1000,"road width");
            optionalNumber(r.get("confidence"),0,1,"confidence");
            polygon(r.path("points"));
        }
    }
    private static void optionalNumber(JsonNode n,double min,double max,String label) {
        if(n==null||n.isNull()) return;
        if(!n.isNumber()||!Double.isFinite(n.asDouble())||n.asDouble()<min||n.asDouble()>max)
            throw ApiProblem.invalid("Invalid "+label+". Leave unreadable measurements blank.");
    }
    private static void polygon(JsonNode points) {
        if(!points.isArray()||points.size()<3||points.size()>64) throw ApiProblem.invalid("Each polygon needs 3–64 vertices.");
        double area=0;
        for(int i=0;i<points.size();i++) {
            JsonNode p=points.get(i),q=points.get((i+1)%points.size());
            if(!p.hasNonNull("x")||!p.hasNonNull("y")) throw ApiProblem.invalid("Every vertex needs x and y.");
            optionalNumber(p.get("x"),0,100,"vertex x"); optionalNumber(p.get("y"),0,100,"vertex y");
            area+=p.path("x").asDouble()*q.path("y").asDouble()-q.path("x").asDouble()*p.path("y").asDouble();
        }
        if(Math.abs(area)<0.0001) throw ApiProblem.invalid("A polygon cannot have zero area.");
    }
}
