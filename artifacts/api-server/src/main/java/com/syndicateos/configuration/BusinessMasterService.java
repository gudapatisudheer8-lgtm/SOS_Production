package com.syndicateos.configuration;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import com.syndicateos.core.Values;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Inert business choices only. A catalog entry cannot grant roles or execute code. */
@Service
public class BusinessMasterService {
    private final JdbcTemplate jdbc;
    private final ConfigurationService configuration;
    private final TransactionTemplate tx;
    public BusinessMasterService(JdbcTemplate jdbc, ConfigurationService configuration, TransactionTemplate tx) {
        this.jdbc=jdbc; this.configuration=configuration; this.tx=tx;
    }
    public Map<String,Object> read(SessionAccount actor) {
        actor.business();
        return tx.execute(status -> {
            // Serialize catalog snapshots with edits, so revision always identifies the returned rows.
            Long revision=jdbc.queryForObject("SELECT revision FROM sos.master_catalog_revision WHERE singleton=true FOR SHARE",Long.class);
            List<Map<String,Object>> items=new ArrayList<>();
            for (Map<String,Object> row : jdbc.queryForList("""
                SELECT * FROM sos.business_masters
                WHERE (? OR enabled) ORDER BY group_code,position,value_code
                ""","OWNER".equals(actor.role()))) {
                Map<String,Object> item=new LinkedHashMap<>();
                item.put("group",row.get("group_code")); item.put("key",row.get("value_code"));
                item.put("label",row.get("label")); item.put("position",row.get("position"));
                item.put("enabled",row.get("enabled")); item.put("revision",row.get("revision"));
                item.put("metadata",configuration.parse(row.get("metadata")));
                items.add(item);
            }
            return Map.of("items",items,"revision",revision);
        });
    }
    public Map<String,Object> save(SessionAccount actor,JsonNode input) {
        actor.owner();
        String group=Values.text(input,"group",64), key=Values.text(input,"key",160), label=Values.text(input,"label",240);
        if (!group.matches("[a-z][a-z0-9_-]{0,63}")) throw ApiProblem.invalid("Use a valid configuration group.");
        if (!input.path("position").canConvertToInt() || !input.path("position").isIntegralNumber() || input.path("position").asInt()<0
            || !input.path("enabled").isBoolean()) throw ApiProblem.invalid("Position and enabled are required.");
        JsonNode metadata=input.path("metadata");
        if (!metadata.isObject() || metadata.toString().length()>16384) throw ApiProblem.invalid("Supply bounded configuration metadata.");
        // Secret material and security permissions never belong in business catalogs.
        for (String field : List.of("password","credential","token","secret","sql","script","permissions","grants"))
            if (metadata.has(field)) throw ApiProblem.invalid("Security or executable settings are not business configuration.");
        return tx.execute(status -> {
            jdbc.queryForObject("SELECT revision FROM sos.master_catalog_revision WHERE singleton=true FOR UPDATE",Long.class);
            if (input.hasNonNull("revision")) {
                if (jdbc.update("""
                    UPDATE sos.business_masters SET label=?,position=?,enabled=?,metadata=?::jsonb,
                    revision=revision+1,updated_at=now() WHERE group_code=? AND value_code=? AND revision=?
                    """,label,input.path("position").asInt(),input.path("enabled").asBoolean(),metadata.toString(),group,key,Values.revision(input))!=1)
                    throw ApiProblem.conflict();
            } else {
                if (jdbc.update("""
                    INSERT INTO sos.business_masters(group_code,value_code,label,position,enabled,metadata)
                    VALUES (?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING
                    """,group,key,label,input.path("position").asInt(),input.path("enabled").asBoolean(),metadata.toString())!=1)
                    throw ApiProblem.conflict();
            }
            jdbc.update("UPDATE sos.master_catalog_revision SET revision=revision+1 WHERE singleton=true");
            configuration.audit(actor,"BUSINESS_MASTER_UPDATED",null,null);
            return Map.of("status","ok","entity",Map.of("group",group,"key",key));
        });
    }
}
