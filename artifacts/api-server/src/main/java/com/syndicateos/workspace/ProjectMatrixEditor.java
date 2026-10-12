package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.*;
import com.syndicateos.erp.ErpService;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Runs inside the project-save transaction, retaining live inventory identities. */
final class ProjectMatrixEditor {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ErpService erp;
    private static final Map<String,List<String>> FACINGS=Map.of(
        "east",List.of("East"),"north",List.of("North"),"west",List.of("West"),
        "south",List.of("South"),"corner",List.of("North-East Corner","South-East Corner"),
        "commercial",List.of("Commercial"));
    ProjectMatrixEditor(JdbcTemplate jdbc,ObjectMapper json,ErpService erp) {
        this.jdbc=jdbc;this.json=json;this.erp=erp;
    }
    private ObjectNode data(Object value) {
        try { return (ObjectNode)json.readTree(value.toString()); }
        catch(Exception e) { throw ApiProblem.invalid("Saved plot details could not be read."); }
    }
    private BigDecimal number(JsonNode value) {
        try { return new BigDecimal(value.asText()); }
        catch(Exception e) { throw ApiProblem.invalid("Supply a valid plot area."); }
    }
    private ObjectNode mutation(UUID project,UUID request,String suffix,String kind) {
        return json.createObjectNode().put("projectId",project.toString()).put("kind",kind)
            .put("requestId",UUID.nameUUIDFromBytes((request+":"+suffix).getBytes(StandardCharsets.UTF_8)).toString());
    }
    int apply(SessionAccount actor,UUID project,UUID request,JsonNode definition,JsonNode values,JsonNode matrix) {
        if(matrix.isMissingNode()) return 0;
        if(!"plots".equals(definition.path("inventory").path("kind").asText()) ||
            !matrix.isObject() || !matrix.path("groups").isArray() || matrix.path("groups").size()!=6 ||
            !matrix.path("records").isArray() || matrix.path("records").size()>2000)
            throw ApiProblem.invalid("Supply the six facing groups and saved plot revisions.");
        var rows=jdbc.queryForList("""
            SELECT e.id,e.data,e.status,e.revision,
              EXISTS(SELECT 1 FROM sos.erp_inventory_reservations r WHERE r.inventory_id=e.id AND r.state='active') AS reserved,
              EXISTS(SELECT 1 FROM sos.erp_records r WHERE r.inventory_id=e.id AND r.status<>'deleted') AS referenced
            FROM sos.erp_records e WHERE e.project_id=? AND e.kind='plots' AND e.status<>'deleted' ORDER BY e.created_at,e.id
            """,project);
        Map<UUID,Integer> revisions=new HashMap<>();
        for(JsonNode record:matrix.path("records")) {
            UUID id=Values.id(record,"recordId");
            if(revisions.put(id,Values.revision(record))!=null) throw ApiProblem.invalid("Repeated plot revision.");
        }
        if(revisions.size()!=rows.size()) throw ApiProblem.conflict();
        for(var row:rows) if(!Objects.equals(revisions.get((UUID)row.get("id")),row.get("revision"))) throw ApiProblem.conflict();
        Set<String> keys=new HashSet<>();
        int target=0;
        for(JsonNode group:matrix.path("groups")) {
            String key=group.path("key").asText();
            JsonNode count=group.path("count");
            if(!FACINGS.containsKey(key) || !keys.add(key) || !count.isIntegralNumber() || !count.canConvertToInt() ||
                count.asInt()<0 || count.asInt()>2000) throw ApiProblem.invalid("Supply distinct facing groups with whole plot counts.");
            target+=count.asInt();
            if(!group.path("areaSqYards").isNull() && !group.path("areaSqYards").isMissingNode() &&
                number(group.path("areaSqYards")).signum()<=0) throw ApiProblem.invalid("Plot area must be greater than zero.");
        }
        if(target>definition.path("inventory").path("maxRows").asInt(2000) || target>2000)
            throw ApiProblem.invalid("The plot count exceeds the configured project limit.");
        Set<String> used=new HashSet<>();
        int next=1;
        for(var historic:jdbc.queryForList("SELECT data->>'plotNumber' AS number FROM sos.erp_records WHERE project_id=? AND kind='plots'",project)) {
            String value=String.valueOf(historic.get("number"));used.add(value);
            try { int n=Integer.parseInt(value.replaceFirst("^Plot #","")); if(n>=next && n<Integer.MAX_VALUE-2001) next=n+1; }
            catch(NumberFormatException ignored) { /* Non-numeric identifiers remain reserved. */ }
        }
        int changed=0;
        BigDecimal floor=values.hasNonNull("floorRatePerSqYard")?number(values.path("floorRatePerSqYard")):BigDecimal.ZERO;
        for(JsonNode group:matrix.path("groups")) {
            List<String> facings=FACINGS.get(group.path("key").asText());
            List<Map<String,Object>> members=rows.stream().filter(row->facings.contains(data(row.get("data")).path("facing").asText())).toList();
            int count=group.path("count").asInt(), remove=Math.max(0,members.size()-count);
            List<Map<String,Object>> removable=members.stream().filter(row->
                "approved".equals(row.get("status")) && "available".equals(data(row.get("data")).path("status").asText()) &&
                !Boolean.TRUE.equals(row.get("reserved")) && !Boolean.TRUE.equals(row.get("referenced"))).toList();
            if(remove>removable.size()) throw ApiProblem.invalid("The "+group.path("key").asText()+" count cannot remove plots with bookings or history.");
            Set<UUID> removed=new HashSet<>();
            for(int i=removable.size()-1;i>=removable.size()-remove;i--) {
                var row=removable.get(i); UUID id=(UUID)row.get("id");removed.add(id);
                var input=mutation(project,request,"remove:"+id,"plots").put("recordId",id.toString()).put("revision",(Integer)row.get("revision"));
                erp.execute(actor,"erp.delete",input);changed++;
            }
            BigDecimal area=group.hasNonNull("areaSqYards")?number(group.path("areaSqYards")):null;
            for(var row:members) {
                UUID id=(UUID)row.get("id");ObjectNode old=data(row.get("data")), updated=old.deepCopy();
                if(removed.contains(id) || !"approved".equals(row.get("status")) ||
                    !"available".equals(old.path("status").asText()) || Boolean.TRUE.equals(row.get("reserved"))) continue;
                if(area!=null && number(old.path("areaSqYards")).compareTo(area)!=0) updated.put("areaSqYards",area);
                if(floor.signum()>0 && number(old.path("ratePerSqYard")).compareTo(floor)<0) updated.put("ratePerSqYard",floor);
                if(updated.equals(old)) continue;
                var input=mutation(project,request,"edit:"+id,"plots").put("recordId",id.toString()).put("revision",(Integer)row.get("revision"));
                input.set("data",updated);erp.execute(actor,"erp.save",input);changed++;
            }
            for(int i=members.size();i<count;i++) {
                if(area==null) throw ApiProblem.invalid("Specify an area for new "+group.path("key").asText()+" plots.");
                while(used.contains(Integer.toString(next))) next++;
                String label=Integer.toString(next++);used.add(label);
                var input=mutation(project,request,"new:"+group.path("key").asText()+":"+i,"plots");
                input.set("data",json.createObjectNode().put("plotNumber",label).put("facing",facings.getFirst())
                    .put("areaSqYards",area).put("ratePerSqYard",floor).put("status","available"));
                erp.execute(actor,"erp.save",input);changed++;
            }
        }
        if(values.hasNonNull("extentValue") && values.hasNonNull("extentUnit")) {
            JsonNode conversion=definition.path("rules").path("unitConversions").path(values.path("extentUnit").asText());
            if(!conversion.isNumber()) throw ApiProblem.invalid("An extent-unit conversion is not configured.");
            BigDecimal gross=number(values.path("extentValue")).multiply(conversion.decimalValue());
            BigDecimal deductions=values.path("roadDeductionPercent").decimalValue().add(values.path("openSpacePercent").decimalValue());
            BigDecimal full=definition.path("rules").path("fixedEquityTotal").decimalValue();
            if(full.signum()<=0) throw ApiProblem.invalid("The project area convention is not configured.");
            BigDecimal available=gross.multiply(full.subtract(deductions)).divide(full);
            BigDecimal allocated=jdbc.queryForObject("SELECT COALESCE(sum((data->>'areaSqYards')::numeric),0) FROM sos.erp_records WHERE project_id=? AND kind='plots' AND status<>'deleted'",BigDecimal.class,project);
            if(available.signum()<0 || allocated.compareTo(available)>0) throw ApiProblem.invalid("Plot areas exceed the project's remaining extent after recorded deductions.");
        }
        return changed;
    }
}
