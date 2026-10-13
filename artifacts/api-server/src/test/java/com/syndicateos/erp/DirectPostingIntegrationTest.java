package com.syndicateos.erp;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
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
    "spring.flyway.enabled=false", "sos.registration-initial-delay-ms=1000000", "sos.push-initial-delay-ms=1000000"
})
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class DirectPostingIntegrationTest {
    @Autowired ErpService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired NotificationController notifications;
    @Autowired RegistrationService registrations;
    @Autowired BrowserPushService push;
    @Autowired org.springframework.test.web.servlet.MockMvc http;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwords;
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
    private UUID paymentPlot(Fixture f) {
        UUID plot=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id)
            VALUES(?,?,?,'plots','{"plotNumber":"3","areaSqYards":150,"status":"available","ratePerSqYard":10000}'::jsonb,'{}','approved',?,?)
            """,plot,f.project,f.firm,f.accountant.identityId(),UUID.randomUUID());
        return plot;
    }
    private Map<String,Object> plotPayment(Fixture f,UUID plot,int amount) {
        return new HashMap<>(Map.of("inventoryId",plot.toString(),"buyerName","Synthetic payment buyer","buyerPhone","9888880099",
            "advanceReceived",amount,"ratePerSqYard",10000,"accountId",f.bank.toString(),"paymentMode","UPI","date","2026-10-13"));
    }
    @SuppressWarnings("unchecked")
    private Map<String,Object> paymentSummary(Fixture f,UUID plot) {
        return ((Map<String,Map<String,Object>>)service.read(f.accountant,f.project).get("bookingPayments")).get(plot.toString());
    }
    @Test void cumulativePlotReceiptsLockPriceAndPreventOverpayment() {
        var f=fixture(); UUID plot=paymentPlot(f);
        var input=plotPayment(f,plot,100000);
        UUID first=save(f,"bookings",input,UUID.randomUUID(),f.accountant);
        assertEquals("1400000.00",new BigDecimal(paymentSummary(f,plot).get("balance").toString()).setScale(2).toPlainString());
        UUID request=UUID.randomUUID();
        UUID second=save(f,"bookings",input,request,f.partner);
        assertEquals(second,save(f,"bookings",input,request,f.partner));
        balance(f,"201000");
        var summary=paymentSummary(f,plot);
        assertEquals(0,new BigDecimal("200000").compareTo(new BigDecimal(summary.get("collected").toString())));
        assertEquals(0,new BigDecimal("1300000").compareTo(new BigDecimal(summary.get("balance").toString())));
        assertEquals(0,new BigDecimal("100000").compareTo(jdbc.queryForObject("SELECT (data->>'advanceReceived')::numeric FROM sos.erp_records WHERE id=?",BigDecimal.class,first)));
        var receipts=(List<?>)summary.get("receipts");
        assertEquals(2,receipts.size());
        assertEquals(0,new BigDecimal("1400000").compareTo(new BigDecimal(((Map<?,?>)receipts.getFirst()).get("balanceAfter").toString())));
        input.put("advanceReceived",1300001);
        assertThrows(ApiProblem.class,()->save(f,"bookings",input,UUID.randomUUID(),f.accountant));
        input.put("advanceReceived",100000); input.put("ratePerSqYard",11000);
        assertThrows(ApiProblem.class,()->save(f,"bookings",input,UUID.randomUUID(),f.accountant));
        input.put("ratePerSqYard",10000); input.put("buyerName","Another buyer");
        assertThrows(ApiProblem.class,()->save(f,"bookings",input,UUID.randomUUID(),f.accountant));
        input.put("buyerName","Synthetic payment buyer");
        jdbc.update("UPDATE sos.projects SET details=jsonb_set(details,'{floorRatePerSqYard}','20000') WHERE id=?",f.project);
        jdbc.update("UPDATE sos.erp_records SET data=jsonb_set(data,'{status}','\"sold\"') WHERE id=?",plot);
        input.put("advanceReceived",1300000);
        save(f,"bookings",input,UUID.randomUUID(),f.accountant);
        balance(f,"1501000");
        assertEquals(0,new BigDecimal(paymentSummary(f,plot).get("balance").toString()).signum());
        assertEquals("sold",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,plot));
        input.put("advanceReceived",1);
        assertThrows(ApiProblem.class,()->save(f,"bookings",input,UUID.randomUUID(),f.accountant));
        input.put("advanceReceived",0);
        assertThrows(ApiProblem.class,()->save(f,"bookings",input,UUID.randomUUID(),f.accountant));
    }
    @Test void correctedAdditionalReceiptDoesNotReleaseBookingOrLoseHistory() {
        var f=fixture(); UUID plot=paymentPlot(f);
        var input=plotPayment(f,plot,100000);
        UUID first=save(f,"bookings",input,UUID.randomUUID(),f.accountant);
        UUID second=save(f,"bookings",input,UUID.randomUUID(),f.partner);
        assertThrows(ApiProblem.class,()->refer(f,first,UUID.randomUUID(),f.accountant));
        refer(f,second,UUID.randomUUID(),f.partner);
        balance(f,"101000");
        assertEquals("reserved",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,plot));
        assertEquals(0,new BigDecimal("1400000").compareTo(new BigDecimal(paymentSummary(f,plot).get("balance").toString())));
        input.put("advanceReceived",110000);
        submit(f,second,UUID.randomUUID(),input,f.partner);
        balance(f,"211000");
        var summary=paymentSummary(f,plot);
        assertEquals(0,new BigDecimal("1290000").compareTo(new BigDecimal(summary.get("balance").toString())));
        assertEquals(3,((List<?>)summary.get("receipts")).size());
    }
    @Test void linkedBankReceiptAlsoUsesOutstandingCap() {
        var f=fixture(); UUID plot=paymentPlot(f);
        UUID booking=save(f,"bookings",plotPayment(f,plot,100000),UUID.randomUUID(),f.accountant);
        var receipt=new HashMap<String,Object>(Map.of("accountId",f.bank.toString(),"amount",100000,
            "type","credit","category","plot_booking_advance","paymentMode","UPI","description","Later customer advance","date","2026-10-13","bookingId",booking.toString()));
        save(f,"transactions",receipt,UUID.randomUUID(),f.accountant);
        balance(f,"201000");
        assertEquals(0,new BigDecimal("1300000").compareTo(new BigDecimal(paymentSummary(f,plot).get("balance").toString())));
        receipt.put("amount",1300001);
        assertThrows(ApiProblem.class,()->save(f,"transactions",receipt,UUID.randomUUID(),f.accountant));
        balance(f,"201000");
    }
    @Test void concurrentPlotCollectionsCannotExceedRemainingBalance() throws Exception {
        var f=fixture(); UUID plot=paymentPlot(f);
        save(f,"bookings",plotPayment(f,plot,1400000),UUID.randomUUID(),f.accountant);
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var barrier=new java.util.concurrent.CyclicBarrier(2);
            java.util.concurrent.Callable<Boolean> collect=()-> {
                barrier.await();
                try { save(f,"bookings",plotPayment(f,plot,75000),UUID.randomUUID(),f.accountant); return true; }
                catch(ApiProblem e) { return false; }
            };
            var a=pool.submit(collect); var b=pool.submit(collect);
            assertNotEquals(a.get(15,java.util.concurrent.TimeUnit.SECONDS),b.get(15,java.util.concurrent.TimeUnit.SECONDS));
            balance(f,"1476000");
            assertEquals(0,new BigDecimal("25000").compareTo(new BigDecimal(paymentSummary(f,plot).get("balance").toString())));
        } finally { pool.shutdownNow(); }
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
    private JsonNode registrationInput(int revision,java.time.Instant starts,String action) {
        var date=starts.atZone(java.time.ZoneId.of("Asia/Kolkata"));
        return json.valueToTree(Map.of("revision",revision,"requestId",UUID.randomUUID().toString(),"action",action,
            "date",date.toLocalDate().toString(),"time",date.toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
            "location","District sub-registrar office","reminderMinutes",List.of(1440,60)));
    }
    private int count(String table,UUID project) { return jdbc.queryForObject("SELECT count(*) FROM sos."+table+" WHERE project_id=?",Integer.class,project); }
    @SuppressWarnings("unchecked")
    private String projectedRegistrationState(Fixture f,UUID plot,SessionAccount actor) {
        var records=(List<Map<String,Object>>)service.read(actor,f.project).get("records");
        var record=records.stream().filter(r->plot.equals(r.get("id"))).findFirst().orElseThrow();
        return ((JsonNode)record.get("data")).path("registrationState").asText();
    }
    @Test void registrationIsIndependentIdempotentScopedAndRestartSafe() {
        var f=fixture(); UUID plot=paymentPlot(f);
        UUID booking=save(f,"bookings",plotPayment(f,plot,100000),UUID.randomUUID(),f.accountant);
        int records=count("erp_records",f.project),postings=count("erp_postings",f.project);
        String money=paymentSummary(f,plot).toString();
        var input=registrationInput(0,java.time.Instant.now().plusSeconds(3*86400),"save");
        JsonNode slot=(JsonNode)registrations.save(f.partner,f.project,plot,input).get("appointment");
        assertEquals("scheduled",projectedRegistrationState(f,plot,f.partner));
        assertEquals("scheduled",projectedRegistrationState(f,plot,f.accountant));
        assertEquals(1,slot.path("revision").asInt());
        assertEquals("scheduled",slot.path("state").asText());
        assertEquals(slot,registrations.save(f.partner,f.project,plot,input).get("appointment"));
        assertEquals(records,count("erp_records",f.project)); assertEquals(postings,count("erp_postings",f.project));
        assertEquals(money,paymentSummary(f,plot).toString()); balance(f,"101000");
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,plot));
        assertEquals(slot,registrations.read(f.accountant,f.project,plot).get("appointment"));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.project_notifications WHERE inventory_id=? AND NOT invalidated",Integer.class,plot));
        var outsider=fixture();
        assertThrows(ApiProblem.class,()->registrations.read(outsider.accountant,f.project,plot));
        assertThrows(ApiProblem.class,()->registrations.save(outsider.partner,f.project,plot,input));
        assertFalse(((List<Map<String,Object>>)notifications.read(outsider.accountant).get("items")).stream().anyMatch(n->plot.toString().equals(n.get("inventoryId"))));
        UUID unrelated=UUID.randomUUID();
        jdbc.update("INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential) VALUES(?,?,'Unassigned','not-a-login-hash',false)",unrelated,"+91"+Math.abs(System.nanoTime()%10000000000L));
        jdbc.update("INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES(?,?,'PARTNER')",f.firm,unrelated);
        assertFalse(registrations.recipients(f.project).stream().anyMatch(n->unrelated.equals(n.get("identity_id"))));
        // A new worker instance sees persisted jobs; no client timer/in-memory schedule.
        jdbc.update("UPDATE sos.registration_jobs SET due_at=now()-interval '1 minute' WHERE inventory_id=?",plot);
        var restarted=new RegistrationService(jdbc,json,new ErpAccess(jdbc,configuration),transaction,gate,true);
        restarted.reminders(); restarted.reminders();
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='sent'",Integer.class,plot));
        assertEquals(6,jdbc.queryForObject("SELECT count(*) FROM sos.project_notifications WHERE inventory_id=? AND NOT invalidated",Integer.class,plot));
        assertEquals(3,((List<Map<String,Object>>)notifications.read(f.partner).get("items")).stream().filter(n->plot.toString().equals(n.get("inventoryId"))).count());
        var edited=registrationInput(1,java.time.Instant.now().plusSeconds(2*3600),"save");
        registrations.save(f.accountant,f.project,plot,edited);
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,plot));
        assertThrows(ApiProblem.class,()->registrations.save(f.partner,f.project,plot,registrationInput(1,java.time.Instant.now().plusSeconds(4*86400),"save")));
        registrations.save(f.partner,f.project,plot,registrationInput(2,java.time.Instant.now().plusSeconds(2*3600),"cancel"));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,plot));
        assertEquals("cancelled",((JsonNode)registrations.read(f.partner,f.project,plot).get("appointment")).path("state").asText());
        assertEquals("cancelled",projectedRegistrationState(f,plot,f.partner));
        assertEquals("cancelled",projectedRegistrationState(f,plot,f.accountant));
        assertEquals(records,count("erp_records",f.project)); assertEquals(postings,count("erp_postings",f.project)); balance(f,"101000");
    }
    @Autowired com.syndicateos.configuration.ConfigurationService configuration;
    @Autowired org.springframework.transaction.support.TransactionTemplate transaction;
    @Autowired com.syndicateos.core.DatabaseGate gate;
    @Test void registrationValidationReleaseAndCompletionStopReminders() {
        var f=fixture(); UUID plot=paymentPlot(f);
        assertThrows(ApiProblem.class,()->registrations.save(f.accountant,f.project,plot,registrationInput(0,java.time.Instant.now().plusSeconds(86400),"save")));
        UUID booking=save(f,"bookings",plotPayment(f,plot,100000),UUID.randomUUID(),f.accountant);
        var input=(com.fasterxml.jackson.databind.node.ObjectNode)registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save");
        input.put("date","2026-02-30");
        assertThrows(ApiProblem.class,()->registrations.save(f.accountant,f.project,plot,input));
        final var past=registrationInput(0,java.time.Instant.now().minusSeconds(86400),"save");
        assertThrows(ApiProblem.class,()->registrations.save(f.accountant,f.project,plot,past));
        var empty=(com.fasterxml.jackson.databind.node.ObjectNode)registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save");
        empty.put("location"," ");
        assertThrows(ApiProblem.class,()->registrations.save(f.accountant,f.project,plot,empty));
        registrations.save(f.accountant,f.project,plot,registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save"));
        refer(f,booking,UUID.randomUUID(),f.accountant);
        assertEquals("cancelled",((JsonNode)registrations.read(f.accountant,f.project,plot).get("appointment")).path("state").asText());
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,plot));
        var second=fixture(); UUID secondPlot=paymentPlot(second);
        save(second,"bookings",plotPayment(second,secondPlot,100000),UUID.randomUUID(),second.accountant);
        registrations.save(second.accountant,second.project,secondPlot,registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save"));
        service.execute(second.accountant,"erp.inventory-stage",json.valueToTree(Map.of("projectId",second.project,"recordId",secondPlot,"revision",revision(secondPlot),"paymentMilestone","Registered & Cleared")));
        assertEquals("completed",((JsonNode)registrations.read(second.accountant,second.project,secondPlot).get("appointment")).path("state").asText());
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,secondPlot));
        var third=fixture(); UUID thirdPlot=paymentPlot(third);
        save(third,"bookings",plotPayment(third,thirdPlot,100000),UUID.randomUUID(),third.accountant);
        registrations.save(third.partner,third.project,thirdPlot,registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save"));
        var cleared=plotPayment(third,thirdPlot,100000); cleared.put("paymentMilestone","Registered & Cleared");
        save(third,"bookings",cleared,UUID.randomUUID(),third.accountant);
        assertEquals("completed",((JsonNode)registrations.read(third.accountant,third.project,thirdPlot).get("appointment")).path("state").asText());
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.registration_jobs WHERE inventory_id=? AND state='pending'",Integer.class,thirdPlot));
        assertEquals("reserved",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?",String.class,thirdPlot));
        assertThrows(ApiProblem.class,()->registrations.save(third.partner,third.project,thirdPlot,registrationInput(1,java.time.Instant.now().plusSeconds(4*86400),"save")));
    }
    @Test void pushFailuresAreBoundedAndNeverRemoveBellNotifications() {
        var f=fixture(); UUID plot=paymentPlot(f),subscription=UUID.randomUUID();
        save(f,"bookings",plotPayment(f,plot,100000),UUID.randomUUID(),f.accountant);
        // Deliberately invalid synthetic keys force a local encryption failure,
        // before any network request can reach a real provider.
        jdbc.update("""
            INSERT INTO sos.browser_push_subscriptions(id,identity_id,firm_id,role_code,endpoint,p256dh,auth)
            VALUES(?,?,?,'ACCOUNTANT',?,'','')
            """,subscription,f.accountant.identityId(),f.firm,"https://fcm.googleapis.com/fcm/send/synthetic-"+subscription);
        var input=registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save");
        registrations.save(f.accountant,f.project,plot,input);
        registrations.save(f.accountant,f.project,plot,input);
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.browser_push_deliveries WHERE subscription_id=?",Integer.class,subscription));
        for(int i=0;i<7;i++) {
            jdbc.update("UPDATE sos.browser_push_deliveries SET next_attempt_at=now()-interval '1 minute' WHERE subscription_id=?",subscription);
            push.deliver();
        }
        assertEquals("failed",jdbc.queryForObject("SELECT state FROM sos.browser_push_deliveries WHERE subscription_id=?",String.class,subscription));
        assertEquals(5,jdbc.queryForObject("SELECT attempts FROM sos.browser_push_deliveries WHERE subscription_id=?",Integer.class,subscription));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.project_notifications WHERE inventory_id=? AND NOT invalidated",Integer.class,plot));
        assertFalse(jdbc.queryForObject("SELECT last_error FROM sos.browser_push_subscriptions WHERE id=?",String.class,subscription).isBlank());
        registrations.save(f.accountant,f.project,plot,registrationInput(1,java.time.Instant.now().plusSeconds(4*86400),"save"));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.browser_push_deliveries WHERE subscription_id=? AND state='pending'",Integer.class,subscription));
        registrations.save(f.partner,f.project,plot,registrationInput(2,java.time.Instant.now().plusSeconds(4*86400),"cancel"));
        // The cancellation's own informational alert remains eligible; the update is obsolete.
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.browser_push_deliveries WHERE subscription_id=? AND state='invalidated'",Integer.class,subscription));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.browser_push_deliveries WHERE subscription_id=? AND state='pending'",Integer.class,subscription));
        assertThrows(ApiProblem.class,()->push.unsubscribe(f.partner,subscription));
        push.unsubscribe(f.accountant,subscription);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.browser_push_deliveries WHERE subscription_id=? AND state='pending'",Integer.class,subscription));
    }
    private String login(Fixture f,SessionAccount actor) throws Exception {
        jdbc.update("UPDATE sos.identities SET credential_hash=? WHERE id=?",passwords.encode("123456"),actor.identityId());
        String mobile=jdbc.queryForObject("SELECT mobile FROM sos.identities WHERE id=?",String.class,actor.identityId());
        var response=http.perform(post("/api/auth/login").contentType("application/json").content(json.writeValueAsString(
            Map.of("role","CLIENT","mobile",mobile,"credential","123456","clientCode",f.accountant.clientCode()))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("token").asText();
    }
    @Test void authenticatedRegistrationBellAndPushEndpointsRemainReachable() throws Exception {
        var f=fixture(); UUID plot=paymentPlot(f);
        save(f,"bookings",plotPayment(f,plot,100000),UUID.randomUUID(),f.accountant);
        int postings=count("erp_postings",f.project);
        String bearer="Bearer "+login(f,f.accountant);
        http.perform(put("/api/erp/"+f.project+"/plots/"+plot+"/registration").header("Authorization",bearer)
            .contentType("application/json").content(registrationInput(0,java.time.Instant.now().plusSeconds(4*86400),"save").toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.state").value("scheduled"));
        http.perform(get("/api/notifications").header("Authorization",bearer))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].inventoryId").value(plot.toString()));
        http.perform(get("/api/browser-push").header("Authorization",bearer))
            .andExpect(status().isOk()).andExpect(jsonPath("$.configured").isBoolean());
        String partner="Bearer "+login(f,f.partner);
        http.perform(get("/api/notifications").header("Authorization",partner))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].inventoryId").value(plot.toString()));
        http.perform(get("/api/erp/"+f.project+"/plots/"+plot+"/registration").header("Authorization",partner))
            .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.state").value("scheduled"));
        assertEquals(postings,count("erp_postings",f.project));
        http.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
        http.perform(get("/api/browser-push")).andExpect(status().isUnauthorized());
    }
}
