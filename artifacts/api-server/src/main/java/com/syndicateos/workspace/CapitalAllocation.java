package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.syndicateos.core.ApiProblem;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Versioned database policy; planned allocations are separate from posted money. */
public final class CapitalAllocation {
    private CapitalAllocation() {}
    public static void validate(JsonNode definition, JsonNode values, Iterable<JsonNode> partners, boolean complete) {
        validate(definition,values,partners,complete,true);
    }
    public static void validate(JsonNode definition, JsonNode values, Iterable<JsonNode> partners, boolean complete, boolean linked) {
        JsonNode policy=definition.path("rules").path("capitalAllocation");
        if(!"equity-linked".equals(policy.path("mode").asText())) return;
        String budgetKey=policy.path("budgetField").asText(),capitalKey=policy.path("capitalField").asText(),equityKey=policy.path("equityField").asText();
        BigDecimal budget=number(values.path(budgetKey)),full=number(policy.path("totalPercent"));
        int scale=policy.path("currencyScale").asInt();
        BigDecimal sum=BigDecimal.ZERO,shares=BigDecimal.ZERO;
        int count=0;
        for(JsonNode row:partners) {
            BigDecimal capital=number(row.path(capitalKey)),equity=number(row.path(equityKey));
            if(capital.signum()<0||equity.signum()<0||capital.compareTo(budget)>0||equity.compareTo(full)>0)
                throw ApiProblem.invalid("Partner allocation cannot exceed the project cost or full equity.");
            if(linked&&row.hasNonNull(equityKey)&&values.hasNonNull(budgetKey)&&row.hasNonNull(capitalKey)) {
                BigDecimal expected=budget.multiply(equity).divide(full,scale,RoundingMode.HALF_UP);
                if(capital.subtract(expected).abs().compareTo(BigDecimal.ONE.movePointLeft(scale))>0)
                    throw ApiProblem.invalid("Planned capital must equal the partner's equity share of the project cost. Recalculate the allocation.");
            }
            sum=sum.add(capital);shares=shares.add(equity);count++;
        }
        if(sum.compareTo(budget)>0||shares.compareTo(full)>0)
            throw ApiProblem.invalid("Combined partner allocations exceed the project cost or full equity.");
        if(complete&&count>0&&shares.compareTo(full)!=0)
            throw ApiProblem.invalid("Allocate the full project equity before creating the project.");
    }
    private static BigDecimal number(JsonNode value) {
        if(value.isMissingNode()||value.isNull()) return BigDecimal.ZERO;
        if(!value.isNumber()) throw ApiProblem.invalid("Use a numeric project cost and partner allocation.");
        return value.decimalValue();
    }
}
