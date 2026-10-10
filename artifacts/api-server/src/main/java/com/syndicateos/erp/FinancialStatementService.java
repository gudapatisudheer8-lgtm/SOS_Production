package com.syndicateos.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** One record per financial event; only posted account legs affect treasury balances. */
@Service
public class FinancialStatementService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public FinancialStatementService(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    public List<Map<String,Object>> read(UUID project) {
        var rows=jdbc.queryForList("""
            SELECT r.*,i.display_name AS recorder,party.display_name AS partner_name,
              ac.data->>'accountName' AS account_name, ac.data->>'accountType' AS account_type,
              coalesce(r.account_id,p.account_id,CASE WHEN r.kind='accounts' THEN r.id END) AS ledger_account,
              coalesce(p.delta,0) AS delta,coalesce(p.posted,false) AS posted,
              coalesce(p.account_posted,false) AS account_posted,
              coalesce(v.names,'') AS approvers
            FROM sos.erp_records r JOIN sos.identities i ON i.id=r.created_by
            LEFT JOIN sos.identities party ON party.id=r.partner_id
            LEFT JOIN LATERAL (
              SELECT sum(debit-credit) FILTER(WHERE account_id IS NOT NULL) AS delta,
                count(*)>0 AS posted,count(account_id)>0 AS account_posted,
                min(account_id::text)::uuid AS account_id
              FROM sos.erp_postings WHERE record_id=r.id
            ) p ON true
            LEFT JOIN sos.erp_records ac ON ac.id=coalesce(r.account_id,p.account_id,CASE WHEN r.kind='accounts' THEN r.id END)
            LEFT JOIN LATERAL (
              SELECT string_agg(w.display_name,', ' ORDER BY w.display_name) AS names
              FROM sos.erp_approvals a JOIN sos.identities w ON w.id=a.actor_id
              WHERE a.record_id=r.id AND a.decision='approved'
            ) v ON true
            LEFT JOIN LATERAL (
              SELECT max(created_at) AS cleared_at FROM sos.erp_audit
              WHERE record_id=r.id AND event='REVIEW_APPROVED'
            ) posted_time ON true
            WHERE r.project_id=? AND r.status<>'deleted'
              AND (r.kind IN ('expenses','investments','drawings','bookings','transactions','reimbursements','settlements','stock-draws')
                OR r.kind='accounts' AND p.account_posted)
            ORDER BY coalesce(posted_time.cleared_at,r.created_at),r.id
            """,project);
        List<Map<String,Object>> entries=new ArrayList<>();
        for(var r:rows) {
            JsonNode d;
            try { d=json.readTree(r.get("data").toString()); }
            catch(Exception e) { throw new IllegalStateException("Invalid financial record",e); }
            String kind=r.get("kind").toString();
            BigDecimal delta=(BigDecimal)r.get("delta");
            boolean posted=Boolean.TRUE.equals(r.get("posted")),accountPosted=Boolean.TRUE.equals(r.get("account_posted"));
            boolean inflow=posted&&accountPosted?delta.signum()>=0:
                Set.of("investments","bookings","settlements","accounts").contains(kind)
                || "transactions".equals(kind)&&"credit".equals(d.path("type").asText());
            BigDecimal amount=accountPosted?delta.abs():(BigDecimal)r.get("amount");
            if(amount.signum()==0) continue;
            String category=switch(kind) {
                case "investments"->"partner_capital"; case "drawings"->"partner_draw";
                case "bookings"->"plot_booking_advance"; case "expenses"->"field_"+d.path("category").asText();
                case "accounts"->"opening_balance"; default->d.path("category").asText(kind);
            };
            var e=new LinkedHashMap<String,Object>();
            e.put("id",r.get("id").toString()); e.put("kind",kind);
            e.put("source","expenses".equals(kind)?"field_expense":"bookings".equals(kind)?"plot_booking":"bank_account");
            e.put("date",d.path("date").asText(r.get("created_at").toString().substring(0,10)));
            e.put("type",inflow?"credit":"debit"); e.put("amount",amount.toPlainString());
            e.put("category",category); e.put("categoryLabel",category.replace('_',' '));
            e.put("description",d.path("notes").asText(d.path("description").asText(d.path("purpose").asText(kind))));
            e.put("referenceNo",d.path("referenceNo").asText(d.path("paymentRefNumber").asText(r.get("id").toString())));
            e.put("accountId",Objects.toString(r.get("ledger_account"),""));
            e.put("accountName",Objects.toString(r.get("account_name"),"Partner funds / non-cash"));
            e.put("accountTypeLabel",Objects.toString(r.get("account_type"),"Non-cash"));
            e.put("enrolledBy",r.get("recorder")); e.put("partnerName",Objects.toString(r.get("partner_name"),""));
            e.put("approverName",r.get("approvers")); e.put("status",r.get("status"));
            e.put("paymentMode",d.path("paymentMode").asText(d.path("payoutMode").asText()));
            e.put("affectsCash",posted&&accountPosted);
            entries.add(e);
        }
        return entries;
    }
}
