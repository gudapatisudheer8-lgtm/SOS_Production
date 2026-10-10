package com.syndicateos.erp;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** No application records: opt-in, disposable database, fixture transaction rolled back. */
@EnabledIfEnvironmentVariable(named="SOS_EXPENSE_TEST_JDBC_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/sos_expense_test")
@SpringBootTest(properties={
    "spring.datasource.url=${SOS_EXPENSE_TEST_JDBC_URL}", "spring.datasource.username=sos_test",
    "spring.datasource.password=", "spring.datasource.hikari.read-only=false",
    "sos.database-name=sos_expense_test", "sos.setup-approved=true", "sos.writes-enabled=true",
    "SOS_OWNER_MOBILE=+919888880000", "SOS_OWNER_INITIAL_PASSWORD=Owner-integration-123",
    "spring.flyway.enabled=false"
})
@Transactional
class ExpenseEnrollmentIntegrationTest {
    @Autowired ErpService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    private JsonNode node(Map<String,Object> data) { return json.valueToTree(data); }
    private UUID save(SessionAccount actor,UUID project,Map<String,Object> data) {
        return saveKind(actor,project,"expenses",data);
    }
    private UUID saveKind(SessionAccount actor,UUID project,String kind,Map<String,Object> data) {
        var response=service.execute(actor,"erp.save",node(Map.of("projectId",project.toString(),"kind",kind,
            "requestId",UUID.randomUUID().toString(),"data",data)));
        return UUID.fromString(((Map<?,?>)response.get("entity")).get("id").toString());
    }
    @Test
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void projectSnapshotReadsOutsideTheTestTransaction() {
        UUID actorId=UUID.randomUUID(),firm=UUID.randomUUID(),project=UUID.randomUUID();
        String code="RO-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash) VALUES (?,?,?,?)",
            actorId,"+91"+Math.abs(System.nanoTime()%10000000000L),"Read-only test","not-a-login-hash");
        jdbc.update("INSERT INTO sos.firms(id,client_code,name,created_by) VALUES (?,?,?,?)",firm,code,"Read-only fixture",actorId);
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES (?,?,'ACCOUNTANT')",firm,actorId);
        var release=jdbc.queryForList("""
            SELECT r.id,r.sector_id FROM sos.sector_releases r JOIN sos.erp_resources e ON e.release_id=r.id
            WHERE r.state='PUBLISHED' AND e.kind='expenses' ORDER BY r.version DESC LIMIT 1
            """).getFirst();
        jdbc.update("INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id) VALUES (?,?,?)",firm,release.get("sector_id"),release.get("id"));
        jdbc.update("INSERT INTO sos.projects(id,firm_id,sector_id,name,created_by,setup_state,setup_release_id) VALUES (?,?,?,?,?,'READY',?)",
            project,firm,release.get("sector_id"),"Read-only project",actorId,release.get("id"));
        var actor=new SessionAccount(actorId,"ACCOUNTANT","Read-only test","+919666662001",false,firm,code);
        var snapshot=service.read(actor,project);
        assertEquals(project,snapshot.get("projectId"));
        assertTrue(((List<?>)snapshot.get("statement")).isEmpty());
    }
    private void review(SessionAccount actor,UUID project,UUID record,int revision) {
        service.execute(actor,"erp.review",node(Map.of("projectId",project.toString(),"recordId",record.toString(),
            "revision",revision,"decision","approved")));
    }
    private BigDecimal balance(UUID account) {
        return jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE account_id=?",BigDecimal.class,account);
    }
    private void assertMoney(String expected,UUID account) {
        assertEquals(0,new BigDecimal(expected).compareTo(balance(account)));
    }
    private void clear(SessionAccount first,SessionAccount second,UUID project,UUID id) {
        review(first,project,id,1);
        if("pending".equals(jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,id)))
            review(second,project,id,2);
        assertEquals("approved",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,id));
    }
    @Test void accountantExpenseIsPendingAndOnlyIndependentFundedApprovalDebits() {
        UUID firm=UUID.randomUUID(),project=UUID.randomUUID(),bank=UUID.randomUUID(),funding=UUID.randomUUID();
        List<SessionAccount> actors=new ArrayList<>();
        for(int i=0;i<3;i++) {
            UUID id=UUID.randomUUID(); String mobile="+91977777200"+i;
            jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential) VALUES(?,?,?,'test-only',false)",
                id,mobile,"Expense test accountant "+i);
            actors.add(new SessionAccount(id,"ACCOUNTANT","Expense test accountant "+i,mobile,false,firm,"EXP-UNIT"));
        }
        var recorder=actors.getFirst();
        jdbc.update("INSERT INTO sos.firms(id,client_code,name,created_by) VALUES(?,'EXP-UNIT','Isolated expense firm',?)",firm,recorder.identityId());
        for(var a:actors) jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES(?,?,'ACCOUNTANT')",firm,a.identityId());
        var release=jdbc.queryForMap("""
            SELECT r.id,r.sector_id FROM sos.sector_releases r JOIN sos.erp_resources e ON e.release_id=r.id
            WHERE r.state='PUBLISHED' AND e.kind='expenses' ORDER BY r.version DESC LIMIT 1
            """);
        jdbc.update("INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id) VALUES(?,?,?)",firm,release.get("sector_id"),release.get("id"));
        jdbc.update("INSERT INTO sos.projects(id,firm_id,sector_id,name,created_by,setup_state,setup_release_id) VALUES(?,?,?,'Expense test project',?,'READY',?)",
            project,firm,release.get("sector_id"),recorder.identityId(),release.get("id"));
        jdbc.update("INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,status,created_by,request_id) VALUES(?,?,?,'accounts','{\"accountName\":\"Test bank\",\"status\":\"active\",\"openingBalance\":0}'::jsonb,'{}',0,'approved',?,?)",
            bank,project,firm,recorder.identityId(),UUID.randomUUID());
        jdbc.update("INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,status,created_by,request_id) VALUES(?,?,?,'transactions','{}','{}',100000,'approved',?,?)",
            funding,project,firm,recorder.identityId(),UUID.randomUUID());
        jdbc.update("INSERT INTO sos.erp_postings(id,record_id,project_id,account_id,ledger_code,debit,credit) VALUES(?,?,?,?,'project-account',100000,0)",
            UUID.randomUUID(),funding,project,bank);
        jdbc.update("INSERT INTO sos.erp_postings(id,record_id,project_id,ledger_code,debit,credit) VALUES(?,?,?,'opening-equity',0,100000)",
            UUID.randomUUID(),funding,project);
        var input=new HashMap<String,Object>(Map.of("amount",40000,"category","Labor Wages","date","2026-10-10",
            "note","Spot tractor payment","paymentSource","project_bank","paymentMode","RTGS / NEFT","accountId",bank.toString()));
        UUID expense=save(recorder,project,input);
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,expense));
        assertNull(jdbc.queryForObject("SELECT partner_id FROM sos.erp_records WHERE id=?",UUID.class,expense));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE record_id=?",Integer.class,expense));
        assertEquals(0,balance(bank).compareTo(new BigDecimal("100000")));
        var records=(List<?>)service.read(recorder,project).get("records");
        assertTrue(records.stream().anyMatch(r -> ((Map<?,?>)r).get("id").equals(expense)
            && ((Map<?,?>)r).get("createdByName").equals(recorder.displayName())));
        assertThrows(ApiProblem.class,()->review(recorder,project,expense,1));
        review(actors.get(1),project,expense,1);
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,expense));
        review(actors.get(2),project,expense,2);
        assertEquals("approved",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,expense));
        assertEquals(0,balance(bank).compareTo(new BigDecimal("60000")));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE record_id=?",Integer.class,expense));
        UUID repeated=expense;
        assertThrows(ApiProblem.class,()->review(actors.get(2),project,repeated,3));
        input.put("amount",80000);
        UUID insufficient=save(recorder,project,input);
        review(actors.get(1),project,insufficient,1);
        assertThrows(ApiProblem.class,()->review(actors.get(2),project,insufficient,2));
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,insufficient));
        assertEquals(0,balance(bank).compareTo(new BigDecimal("60000")));
        input.put("paymentMode","Cash");
        UUID cashExpense=save(recorder,project,input);
        UUID cashAccount=jdbc.queryForObject("SELECT account_record_id FROM sos.project_cash_accounts WHERE project_id=?",UUID.class,project);
        assertEquals(cashAccount,jdbc.queryForObject("SELECT account_id FROM sos.erp_records WHERE id=?",UUID.class,cashExpense));
        assertEquals(0,balance(bank).compareTo(new BigDecimal("60000")));
        UUID payer=UUID.randomUUID();
        jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential) VALUES(?,'+919777772009','Expense test partner','test-only',false)",payer);
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES(?,?,'PARTNER')",firm,payer);
        jdbc.update("INSERT INTO sos.project_memberships(project_id,firm_id,identity_id) VALUES(?,?,?)",project,firm,payer);
        input.put("paymentSource","individual"); input.put("partnerId",payer.toString()); input.remove("accountId");
        for(var mode:Map.of("Cash / Spot Voucher","Cash","UPI / Online","UPI").entrySet()) {
            input.put("paymentMode",mode.getKey());
            UUID personal=save(recorder,project,input);
            assertEquals(mode.getValue(),jdbc.queryForObject("SELECT data->>'paymentMode' FROM sos.erp_records WHERE id=?",String.class,personal));
            assertNull(jdbc.queryForObject("SELECT account_id FROM sos.erp_records WHERE id=?",UUID.class,personal));
            assertEquals(payer,jdbc.queryForObject("SELECT partner_id FROM sos.erp_records WHERE id=?",UUID.class,personal));
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE record_id=?",Integer.class,personal));
        }
        var partner=new SessionAccount(payer,"PARTNER","Expense test partner","+919777772009",false,firm,"EXP-UNIT");
        UUID bankInvestment=saveKind(partner,project,"investments",new HashMap<>(Map.of(
            "partnerId",payer.toString(),"accountId",bank.toString(),"amount","10000.25",
            "date","2026-10-10","purpose","Partner capital","paymentMode","Bank Wire (RTGS / NEFT)")));
        assertMoney("60000",bank);
        clear(recorder,actors.get(1),project,bankInvestment);
        assertMoney("70000.25",bank);
        UUID cashInvestment=saveKind(recorder,project,"investments",new HashMap<>(Map.of(
            "partnerId",payer.toString(),"accountId",cashAccount.toString(),"amount","5000.50",
            "date","2026-10-10","purpose","Partner capital","paymentMode","Cash - Site Cash Vault Deposit")));
        clear(actors.get(1),actors.get(2),project,cashInvestment);
        assertMoney("5000.50",cashAccount);
        var paid=new HashMap<String,Object>(Map.of("partnerId",payer.toString(),"accountId",cashAccount.toString(),
            "paymentSource","project_bank","paymentMode","Cash","category","Labor Wages",
            "amount","300.25","date","2026-10-10","note","Partner spent project cash"));
        UUID paidExpense=save(partner,project,paid);
        clear(recorder,actors.get(1),project,paidExpense);
        UUID bankDraw=saveKind(partner,project,"drawings",new HashMap<>(Map.of(
            "partnerId",payer.toString(),"accountId",bank.toString(),"amount","2000.05","date","2026-10-10",
            "purpose","Partner drawing","payoutMode","Bank Transfer","destinationAccountDetails","Partner bank")));
        clear(recorder,actors.get(1),project,bankDraw);
        UUID cashDraw=saveKind(recorder,project,"drawings",new HashMap<>(Map.of(
            "partnerId",payer.toString(),"accountId",bank.toString(),"amount","1000.10","date","2026-10-10",
            "purpose","Partner cash drawing","payoutMode","Field Vault Cash","destinationAccountDetails","Cash handover")));
        assertEquals(cashAccount,jdbc.queryForObject("SELECT account_id FROM sos.erp_records WHERE id=?",UUID.class,cashDraw));
        clear(actors.get(1),actors.get(2),project,cashDraw);
        UUID plot=UUID.randomUUID();
        jdbc.update("INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id) VALUES(?,?,?,'plots','{\"plotNumber\":\"1\",\"status\":\"available\",\"areaSqYards\":100,\"ratePerSqYard\":1000}'::jsonb,'{}','approved',?,?)",
            plot,project,firm,recorder.identityId(),UUID.randomUUID());
        var booking=new HashMap<String,Object>(Map.of("inventoryId",plot.toString(),"accountId",bank.toString(),
            "buyerName","Test purchaser","buyerPhone","+919777773001","advanceReceived","2000.99",
            "paymentMode","RTGS / NEFT","date","2026-10-10","ratePerSqYard",1000));
        UUID receipt=saveKind(recorder,project,"bookings",booking);
        clear(actors.get(1),actors.get(2),project,receipt);
        assertMoney("70001.19",bank);
        assertMoney("3700.15",cashAccount);
        assertEquals(0,jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE project_id=?",BigDecimal.class,project).signum());
        var accountantView=service.read(recorder,project);
        var partnerView=service.read(partner,project);
        assertEquals(accountantView.get("balances"),partnerView.get("balances"));
        assertEquals(accountantView.get("statement"),partnerView.get("statement"));
        var totals=((List<Map<String,Object>>)partnerView.get("partners")).getFirst();
        assertEquals("15000.75",totals.get("invested")); assertEquals("3000.15",totals.get("drawings"));
        assertEquals("0",new BigDecimal(totals.get("expenses").toString()).stripTrailingZeros().toPlainString());
        var statement=(List<Map<String,Object>>)partnerView.get("statement");
        assertEquals(statement.size(),statement.stream().map(e->e.get("id")).distinct().count());
    }
}
