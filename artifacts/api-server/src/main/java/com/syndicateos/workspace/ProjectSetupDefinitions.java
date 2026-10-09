package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.core.ApiProblem;
import java.util.*;

/** Structural/security validation; choice lists and business defaults live in PostgreSQL. */
public final class ProjectSetupDefinitions {
    private ProjectSetupDefinitions() {}
    public static void validate(JsonNode def) {
        if(!def.isObject()||def.toString().length()>60000||def.path("title").asText().isBlank())
            throw ApiProblem.invalid("Supply a bounded project setup definition with a title.");
        if(!def.path("sections").isArray()||def.path("sections").isEmpty()||def.path("sections").size()>12)
            throw ApiProblem.invalid("Configure 1–12 setup sections.");
        Set<String> sections=new HashSet<>(),keys=new HashSet<>();
        for(JsonNode s:def.path("sections")) {
            if(!sections.add(s.path("key").asText())||s.path("title").asText().isBlank()) throw ApiProblem.invalid("Setup sections need unique keys and titles.");
            check(s.path("fields"),keys);
        }
        if(!keys.containsAll(Set.of("name","projectCode"))) throw ApiProblem.invalid("Project setup requires name and code.");
        check(def.path("partnerFields"),new HashSet<>());
        check(def.path("accountFields"),new HashSet<>());
        check(def.path("settingsFields"),new HashSet<>());
        JsonNode inventory=def.path("inventory");
        if(!inventory.isMissingNode()&&!inventory.isNull()) {
            if(!Set.of("plots","units").contains(inventory.path("kind").asText())||inventory.path("maxRows").asInt()<1||inventory.path("maxRows").asInt()>2000)
                throw ApiProblem.invalid("Inventory needs a supported handler and a safe limit.");
            Set<String> groupKeys=new HashSet<>();check(inventory.path("fields"),groupKeys);
            for(String key:List.of("count","area","facing","rate"))
                if(!groupKeys.contains(inventory.path("mappings").path(key).asText())) throw ApiProblem.invalid("Missing configured inventory mapping.");
            if(!Set.of("plotNumber","unitNumber").contains(inventory.path("mappings").path("number").asText())) throw ApiProblem.invalid("Invalid inventory numbering binding.");
            if(!keys.contains(inventory.path("rateField").asText())) throw ApiProblem.invalid("Inventory needs a project rate field.");
        }
        for(String key:List.of("maxPartners","maxAccounts"))
            if(def.path("rules").path(key).asInt()<1||def.path("rules").path(key).asInt()>100) throw ApiProblem.invalid("Configure safe setup row limits.");
        if(def.path("rules").path("fixedEquityTotal").asInt()!=100) throw ApiProblem.invalid("Equity is a percentage of a whole and must total 100.");
        JsonNode allocation=def.path("rules").path("capitalAllocation");
        if(!allocation.isMissingNode()) {
            Set<String> partnerKeys=new HashSet<>();for(JsonNode f:def.path("partnerFields")) partnerKeys.add(f.path("key").asText());
            if(!"equity-linked".equals(allocation.path("mode").asText())||!keys.contains(allocation.path("budgetField").asText())
                ||!partnerKeys.contains(allocation.path("capitalField").asText())||!partnerKeys.contains(allocation.path("equityField").asText())
                ||!allocation.path("totalPercent").equals(def.path("rules").path("fixedEquityTotal"))
                ||!allocation.path("currencyScale").isInt()||allocation.path("currencyScale").asInt()<0||allocation.path("currencyScale").asInt()>6)
                throw ApiProblem.invalid("Configure valid budget-linked capital bindings and rounding.");
        }
    }
    private static void check(JsonNode fields,Set<String> keys) {
        if(!fields.isArray()||fields.size()>100) throw ApiProblem.invalid("Configure bounded field arrays.");
        for(JsonNode f:fields) {
            if(!f.path("key").asText().matches("[a-z][A-Za-z0-9]{0,63}")||!keys.add(f.path("key").asText())
                ||f.path("label").asText().isBlank()||!f.path("required").isBoolean()
                ||!Set.of("text","multiline","number","boolean","date","select").contains(f.path("kind").asText()))
                throw ApiProblem.invalid("Setup fields must have valid unique bindings, labels, kinds and required flags.");
            if("select".equals(f.path("kind").asText())) {
                Set<String> options=new HashSet<>();
                if(!f.path("options").isArray()||f.path("options").isEmpty()||f.path("options").size()>100) throw ApiProblem.invalid("Configure dropdown options.");
                for(JsonNode option:f.path("options")) if(!option.isTextual()||option.asText().isBlank()||!options.add(option.asText())) throw ApiProblem.invalid("Dropdown choices must be unique text.");
            }
        }
    }
}
