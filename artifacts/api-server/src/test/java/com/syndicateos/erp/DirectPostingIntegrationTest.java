package com.syndicateos.erp;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.core.ApiProblem;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/** Opt-in disposable database only. No real users, AWS, or preview business data. */
@EnabledIfEnvironmentVariable(named="SOS_DIRECT_TEST_JDBC_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/sos_direct_test")
@SpringBootTest(properties={
    "spring.datasource.url=${SOS_DIRECT_TEST_JDBC_URL}", "spring.datasource.username=sos_test",
    "spring.datasource.password=", "spring.datasource.hikari.read-only=false",
    "sos.database-name=sos_direct_test", "sos.setup-approved=true", "sos.writes-enabled=true",
    "SOS_OWNER_MOBILE=+919888880001", "SOS_OWNER_INITIAL_PASSWORD=Direct-test-owner-123",
    "spring.flyway.enabled=false"
})
class DirectPostingIntegrationTest {
    @Autowired ErpService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired NotificationController notifications;
    record Fixture(UUID firm,UUID project,UUID bank,SessionAccount accountant,SessionAccount partner) {}
    private Fixture fixture() {
        UUID firm=UUID.randomUUID(),project=UUID.randomUUID(),bank=UUID.randomUUID(),staff=UUID.randomUUID(),partner=UUID.randomUUID();
        String code="DP-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);
        for(UUID id:List.of(staff,partner))
            jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential) VALUES(?,?,?,'not-a-login-hash',false)",
                id,"+91"+Math.abs(System.nanoTime()%10000000000L),id.equals(staff)?"Direct test accountant":"Direct test partner");
        jdbc.update("INSERT INTO sos.firms(id,client_code,name,created_by) VALUES(?,?,?,?)",firm,code,"Isolated direct posting fixture",staff);
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES(?,?,'ACCOUNTANT'),(?,?,'PARTNER')",firm,staff,firm,partner);
        var release=jdbc.queryForList("""
            SELECT r.id,r.sector_id FROM sos.sector_releases r JOIN sos.sectors s ON s.id=r.sector_id
            WHERE r.state='PUBLISHED' AND s.code='REAL_ESTATE_OPEN_PLOTTING' ORDER BY r.version DESC LIMIT 1
            """);
        if(release.isEmpty()) release=jdbc.queryForList("""
            SELECT r.id,r.sector_id FROM sos.sector_releases r JOIN sos.erp_resources e ON e.release_id=r.id
            WHERE r.state='PUBLISHED' AND e.kind='plots' ORDER BY r.version DESC LIMIT 1
            """);
        var rel=release.getFirst();
        jdbc.update("INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id) VALUES(?,?,?)",firm,rel.get("sector_id"),rel.get("id"));
        jdbc.update("INSERT INTO sos.projects(id,firm_id,sector_id,name,created_by,setup_state,setup_release_id,details) VALUES(?,?,?,'Direct posting project',?,'READY',?,'{\"floorRatePerSqYard\":1}')",
            project,firm,rel.get("sector_id"),staff,rel.get("id"));
        jdbc.update("INSERT INTO sos.project_memberships(project_id,firm_id,identity_id) VALUES(?,?,?)",project,firm,partner);
        jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id)
            VALUES(?,?,?,'accounts','{"accountName":"Test bank","status":"active","openingBalance":1000}'::jsonb,'{}','approved',?,?)
            """,bank,project,firm,staff,UUID.randomUUID());
        jdbc.update("INSERT INTO sos.erp_postings(id,record_id,project_id,account_id,ledger_code,debit,credit) VALUES(?,?,?,?,'bank',1000,0)",
            UUID.randomUUID(),bank,project,bank);
        jdbc.update("INSERT INTO sos.erp_postings(id,record_id,project_id,ledger_code,debit,credit) VALUES(?,?,?,'opening-capital',0,1000)",
            UUID.randomUUID(),bank,project);
        return new Fixture(firm,project,bank,
            new SessionAccount(staff,"ACCOUNTANT","Direct test accountant","",false,firm,code),
            new SessionAccount(partner,"PARTNER","Direct test partner","",false,firm,code));
    }
    private Map<String,Object> expense(Fixture f,int amount) {
        return new HashMap<>(Map.of("amount",amount,"category","Labor Wages","date","2026-10-12",
            "note","Direct posting regression","paymentSource","project_bank","paymentMode","RTGS / NEFT","accountId",f.bank.toString()));
    }
    private UUID save(Fixture f,String kind,Map<String,Object> data,UUID request,SessionAccount actor) {
        return entity(service.execute(actor,"erp.save",json.valueToTree(Map.of("projectId",f.project.toString(),"kind",kind,"requestId",request.toString(),"data",data))));
    }
    private UUID entity(Map<String,Object> result) { return UUID.fromString(((Map<?,?>)result.get("entity")).get("id").toString()); }
    private BigDecimal balance(Fixture f) { return jdbc.queryForObject("SELECT coalesce(sum(debit-credit),0) FROM sos.erp_postings WHERE account_id=?",BigDecimal.class,f.bank); }
    private void balance(Fixture f,String expected) { assertEquals(0,new BigDecimal(expected).compareTo(balance(f))); }
    private int revision(UUID id) { return jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?",Integer.class,id); }
    private Map<String,Object> refer(Fixture f,UUID id,UUID request,SessionAccount actor) {
        return service.execute(actor,"erp.refer-back",json.valueToTree(Map.of("projectId",f.project.toString(),"recordId",id.toString(),
            "revision",revision(id),"requestId",request.toString(),"reason","Wrong amount; correct the source entry")));
    }
    private Map<String,Object> submit(Fixture f,UUID id,UUID request,Map<String,Object> data,SessionAccount actor) {
        return service.execute(actor,"erp.resubmit",json.valueToTree(Map.of("projectId",f.project.toString(),"recordId",id.toString(),
            "revision",revision(id),"requestId",request.toString(),"data",data)));
    }
    @Test void savesPostImmediatelyAndRetryNeverPostsTwice() {
        var f=fixture(); UUID request=UUID.randomUUID();
        UUID id=save(f,"expenses",expense(f,400),request,f.accountant);
        balance(f,"600");
        assertEquals(id,save(f,"expenses",expense(f,400),request,f.accountant));
        balance(f,"600");
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_approvals WHERE record_id=?",Integer.class,id));
        assertThrows(ApiProblem.class,()->service.execute(f.partner,"erp.review",json.valueToTree(Map.of("projectId",f.project.toString()))));
        assertThrows(ApiProblem.class,()->service.execute(f.accountant,"erp.save",json.valueToTree(Map.of("projectId",f.project.toString(),
            "kind","expenses","recordId",id.toString(),"revision",revision(id),"requestId",UUID.randomUUID().toString(),"data",expense(f,500)))));
        balance(f,"600");
    }
    @Test void referBackAndResubmitPreserveBalancedHistoryAndNotifications() {
        var f=fixture(); UUID original=save(f,"expenses",expense(f,400),UUID.randomUUID(),f.accountant);
        UUID request=UUID.randomUUID();
        refer(f,original,request,f.partner);
        balance(f,"1000");
        refer(f,original,request,f.partner);
        balance(f,"1000");
        UUID correctionRequest=UUID.randomUUID();
        UUID replacement=entity(submit(f,original,correctionRequest,expense(f,350),f.accountant));
        balance(f,"650");
        assertEquals(replacement,entity(submit(f,original,correctionRequest,expense(f,350),f.accountant)));
        balance(f,"650");
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE reversal_of=?",Integer.class,original));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE correction_of=?",Integer.class,original));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM (SELECT record_id FROM sos.erp_postings WHERE project_id=? GROUP BY record_id HAVING sum(debit)<>sum(credit)) x",Integer.class,f.project));
        var entries=(List<Map<String,Object>>)service.read(f.accountant,f.project).get("statement");
        assertFalse(entries.isEmpty());
        assertTrue(entries.stream().noneMatch(e->e.containsKey("approverName")||e.containsKey("status")));
        assertTrue(entries.stream().allMatch(e->!e.get("correctionFields").toString().contains("approvalWorkflow")));
        BigDecimal net=entries.stream().filter(e->Boolean.TRUE.equals(e.get("affectsCash"))).map(e->new BigDecimal(e.get("amount").toString())
            .multiply("credit".equals(e.get("type"))?BigDecimal.ONE:BigDecimal.ONE.negate())).reduce(BigDecimal.ZERO,BigDecimal::add);
        assertEquals(0,new BigDecimal("650").compareTo(net));
        var items=(List<Map<String,Object>>)notifications.read(f.partner).get("items");
        assertEquals(3,items.size());
        notifications.markRead(f.partner,UUID.fromString(items.getFirst().get("id").toString()));
        assertEquals(2L,notifications.read(f.partner).get("unread"));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("UPDATE sos.erp_postings SET debit=0 WHERE record_id=?",original));
    }
    @Test void receiptAlreadySpentCannotBeReversedAndCrossFirmIsDenied() {
        var f=fixture();
        UUID receipt=save(f,"investments",new HashMap<>(Map.of("amount",100,"partnerId",f.partner.identityId().toString(),
            "date","2026-10-12","purpose","Land Purchase & Venture Setup","paymentMode","RTGS / NEFT","accountId",f.bank.toString())),UUID.randomUUID(),f.partner);
        save(f,"expenses",expense(f,1050),UUID.randomUUID(),f.accountant);
        balance(f,"50");
        assertThrows(ApiProblem.class,()->refer(f,receipt,UUID.randomUUID(),f.accountant));
        assertEquals("approved",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,receipt));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE reversal_of=?",Integer.class,receipt));
        balance(f,"50");
        var other=fixture();
        assertThrows(ApiProblem.class,()->refer(f,receipt,UUID.randomUUID(),other.accountant));
        assertTrue(((List<?>)notifications.read(other.accountant).get("items")).isEmpty());
        var notice=jdbc.queryForObject("SELECT id FROM sos.project_notifications WHERE record_id=?",UUID.class,receipt);
        assertThrows(ApiProblem.class,()->notifications.markRead(other.accountant,notice));
    }
    @Test void failedCorrectionKeepsDraftAndOnlyAuthorCanResubmit() {
        var f=fixture(); var d=expense(f,200); d.put("partnerId",f.partner.identityId().toString());
        UUID original=save(f,"expenses",d,UUID.randomUUID(),f.partner);
        refer(f,original,UUID.randomUUID(),f.accountant);
        balance(f,"1000");
        assertThrows(ApiProblem.class,()->submit(f,original,UUID.randomUUID(),d,f.accountant));
        var tooMuch=expense(f,2000); tooMuch.put("partnerId",f.partner.identityId().toString());
        assertThrows(ApiProblem.class,()->submit(f,original,UUID.randomUUID(),tooMuch,f.partner));
        balance(f,"1000");
        assertEquals("referred_back",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?",String.class,original));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE correction_of=?",Integer.class,original));
        var corrected=expense(f,100); corrected.put("partnerId",f.partner.identityId().toString());
        submit(f,original,UUID.randomUUID(),corrected,f.partner);
        balance(f,"900");
    }
    @Test void legacyUnpostedEntryDoesNotMoveMoneyUntilAuthorResubmits() {
        var f=fixture(); UUID id=UUID.randomUUID(); var data=expense(f,125);
        jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,account_id,status,created_by,request_id)
            VALUES(?,?,?,'expenses',?::jsonb,?::jsonb,125,?,'pending',?,?)
            """,id,f.project,f.firm,json.valueToTree(data).toString(),json.valueToTree(data).toString(),f.bank,f.accountant.identityId(),UUID.randomUUID());
        balance(f,"1000");
        var entries=(List<Map<String,Object>>)service.read(f.accountant,f.project).get("statement");
        assertTrue(entries.stream().anyMatch(e->id.toString().equals(e.get("id"))&&Boolean.TRUE.equals(e.get("canResubmit"))&&!Boolean.TRUE.equals(e.get("affectsCash"))));
        submit(f,id,UUID.randomUUID(),expense(f,115),f.accountant);
        balance(f,"885");
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE reversal_of=?",Integer.class,id));
    }
    @Test void bookingPostsImmediatelyAndCorrectionReleasesInventory() {
        var f=fixture(); UUID plot=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id)
            VALUES(?,?,?,'plots','{"plotNumber":"1","areaSqYards":100,"status":"available","ratePerSqYard":10}'::jsonb,'{}','approved',?,?)
            """,plot,f.project,f.firm,f.accountant.identityId(),UUID.randomUUID());
        var booking=new HashMap<String,Object>(Map.of("inventoryId",plot.toString(),"buyerName","Synthetic buyer","buyerPhone","9888880099",
            "advanceReceived",100,"ratePerSqYard",12,"accountId",f.bank.toString(),"paymentMode","UPI","date","2026-10-12"));
        UUID id=save(f,"bookings",booking,UUID.randomUUID(),f.accountant);
        balance(f,"1100");
        assertEquals("reserved",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,plot));
        assertEquals("cleared",jdbc.queryForObject("SELECT state FROM sos.erp_inventory_reservations WHERE booking_id=?",String.class,id));
        refer(f,id,UUID.randomUUID(),f.accountant);
        balance(f,"1000");
        assertEquals("available",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,plot));
        assertEquals(0,new BigDecimal("10").compareTo(jdbc.queryForObject("SELECT (data->>'ratePerSqYard')::numeric FROM sos.erp_records WHERE id=?",BigDecimal.class,plot)));
        booking.put("advanceReceived",150);
        submit(f,id,UUID.randomUUID(),booking,f.accountant);
        balance(f,"1150");
        assertEquals("reserved",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,plot));
    }
}
