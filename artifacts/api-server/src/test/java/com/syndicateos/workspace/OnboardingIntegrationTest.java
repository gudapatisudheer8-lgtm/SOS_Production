package com.syndicateos.workspace;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Only a disposable localhost PostgreSQL target can enable this test. Never uses AWS credentials or RDS. */
@EnabledIfEnvironmentVariable(named="SOS_TEST_JDBC_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/sos_test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "spring.datasource.url=${SOS_TEST_JDBC_URL}", "spring.datasource.username=sos_test",
    "spring.datasource.password=", "spring.datasource.hikari.read-only=false",
    "sos.database-name=sos_test", "sos.setup-approved=true", "sos.writes-enabled=true",
    "SOS_OWNER_MOBILE=+919888880000", "SOS_OWNER_INITIAL_PASSWORD=Owner-integration-123",
    "spring.flyway.enabled=false", "sos.upload-directory=${java.io.tmpdir}/sos-test-uploads"
})
class OnboardingIntegrationTest {
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    private JsonNode request(String method,String path,Object data,String token,int expected) {
        HttpHeaders headers=new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        if (token!=null) headers.setBearerAuth(token);
        ResponseEntity<String> response=http.exchange("/api"+path,HttpMethod.valueOf(method),new HttpEntity<>(data,headers),String.class);
        assertEquals(expected,response.getStatusCode().value(),method+" "+path+" returned "+response.getBody());
        try { return json.readTree(response.getBody()); } catch(Exception error) { throw new AssertionError(error); }
    }
    private JsonNode command(String key,Object data,String token,int expected) {
        return request("POST","/commands/"+key,Map.of("data",data),token,expected);
    }
    private JsonNode login(String role,String mobile,String credential,String client,int expected) {
        return request("POST","/auth/login",Map.of("role",role,"mobile",mobile,"credential",credential,"clientCode",client),null,expected);
    }
    private String change(String token,String current,String next) {
        return request("POST","/auth/credential",Map.of("currentCredential",current,"newCredential",next),token,200).path("token").asText();
    }
    @Test void migrationsAndCompleteTenantIsolatedOnboarding() throws Exception {
        String owner=login("OWNER","9888880000","Owner-integration-123","",200).path("token").asText();
        request("GET","/workspace",null,owner,403);
        owner=change(owner,"Owner-integration-123","Owner-updated-123");
        request("GET","/configuration/masters",null,null,401);
        assertTrue(request("GET","/configuration/masters",null,owner,200).path("items").isArray());
        Object master=Map.of("group","integration_choices","key","review","label","Review",
            "position",0,"enabled",true,"metadata",Map.of());
        command("master.save",master,owner,200);
        command("master.save",master,owner,409);
        command("master.save",Map.of("group","integration_choices","key","review","label","Reviewed",
            "position",0,"enabled",true,"metadata",Map.of(),"revision",1),owner,200);
        command("master.save",Map.of("group","integration_choices","key","review","label","Stale edit",
            "position",0,"enabled",true,"metadata",Map.of(),"revision",1),owner,409);
        command("master.save",Map.of("group","integration_choices","key","unsafe","label","Unsafe",
            "position",0,"enabled",true,"metadata",Map.of("password","must-not-be-stored")),owner,400);
        request("POST","/auth/credential",Map.of("currentCredential","Owner-updated-123","newCredential","123456"),owner,400);
        request("POST","/auth/company",Map.of("clientCode","MISSING"),null,404);
        request("POST","/auth/company",Map.of("clientCode",""),null,400);
        JsonNode workspace=request("GET","/workspace",null,owner,200);
        assertEquals(4,workspace.path("sectors").size());
        JsonNode sector=null,other=null;
        for(JsonNode candidate:workspace.path("sectors")) {
            if("construction".equals(candidate.path("code").asText())) sector=candidate;
            if("open-plotting".equals(candidate.path("code").asText())) other=candidate;
        }
        assertNotNull(sector); assertNotNull(other);
        String sectorId=sector.path("id").asText(), releaseId=sector.path("releases").get(0).path("id").asText();
        for (JsonNode s:workspace.path("sectors"))
            assertEquals("valid",command("configuration.validate",Map.of("releaseId",s.path("releases").get(0).path("id").asText()),owner,200).path("status").asText());
        Object assignment=Map.of("sectorId",sectorId,"releaseId",releaseId);
        JsonNode created=command("firm.create",Map.of("name","Test firm A","clientCode","TEST-A","accountantName","Test accountant",
            "accountantMobile","9888880001","assignments",java.util.List.of(assignment)),owner,200);
        String firmA=created.path("entity").path("id").asText();
        JsonNode company=request("POST","/auth/company",Map.of("clientCode"," test-a "),null,200);
        assertEquals("Test firm A",company.path("name").asText());
        assertEquals(2,company.size());
        String temporary=created.path("access").path("temporaryCredential").asText();
        login("CLIENT","9888880001",temporary,"WRONG",401);
        login("CLIENT","9888880001",temporary,"",400);
        login("CLIENT","9888880001","😀".repeat(36),"TEST-A",400);
        login("CLIENT","9888880000","Owner-updated-123","TEST-A",401);
        JsonNode accountantLogin=login("CLIENT","9888880001",temporary," test-a ",200);
        assertEquals("ACCOUNTANT",accountantLogin.path("account").path("role").asText());
        assertEquals(firmA,accountantLogin.path("account").path("firmId").asText());
        String accountant=accountantLogin.path("token").asText();
        command("project.create",Map.of("sectorId",sectorId,"name","Blocked before reset"),accountant,403);
        assertTrue(temporary.matches("[0-9]{6}"));
        for (String invalid : new String[]{"12345","1234567","abcdef","12a456"})
            request("POST","/auth/credential",Map.of("currentCredential",temporary,"newCredential",invalid),accountant,400);
        accountant=change(accountant,temporary,"012345");
        // A valid old credential remains usable only for mandatory conversion.
        jdbc.update("UPDATE sos.identities SET credential_hash=?,must_change_credential=false,credential_version=credential_version+1 WHERE mobile=?",
            new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("Legacy-accountant-123"),"+919888880001");
        JsonNode legacy=login("CLIENT","9888880001","Legacy-accountant-123","TEST-A",200);
        assertTrue(legacy.path("account").path("mustChangeCredential").asBoolean());
        request("GET","/workspace",null,legacy.path("token").asText(),403);
        accountant=change(legacy.path("token").asText(),"Legacy-accountant-123","012345");
        login("CLIENT","9888880001","Legacy-accountant-123","TEST-A",401);
        String detailKey="construction".equals(sector.path("code").asText())?"unitCount":"plotCount";
        Map<String,Object> details=Map.of(detailKey,0);
        String projectA=command("project.create",Map.of("sectorId",sectorId,"name","Zero count project","location","","details",details),accountant,200).path("entity").path("id").asText();
        command("project.create",Map.of("sectorId",other.path("id").asText(),"name","Unassigned sector"),accountant,403);
        command("project.create",Map.of("sectorId",sectorId,"name","Bad data","details",Map.of("unconfiguredField",123)),accountant,400);
        workspace=request("GET","/workspace",null,accountant,200);
        request("GET","/configuration/masters",null,accountant,200);
        command("master.save",master,accountant,403);
        assertEquals(0,workspace.path("projects").get(0).path("details").path(detailKey).asInt());
        assertEquals("",workspace.path("projects").get(0).path("location").asText());
        command("project.update",Map.of("projectId",projectA,"revision",1,"status","ACTIVE","name","Edited project","location","","details",details),accountant,200);
        command("project.update",Map.of("projectId",projectA,"revision",1,"status","ACTIVE","name","Stale overwrite","details",details),accountant,409);
        JsonNode partnerCreated=command("partner.add",Map.of("projectId",projectA,"name","Test partner","mobile","9888880002"),accountant,200);
        String partnerPin=partnerCreated.path("access").path("temporaryCredential").asText();
        login("CLIENT","9888880002",partnerPin,"WRONG",401);
        JsonNode partnerLogin=login("CLIENT","9888880002",partnerPin,"TEST-A",200);
        assertEquals("PARTNER",partnerLogin.path("account").path("role").asText());
        assertEquals(firmA,partnerLogin.path("account").path("firmId").asText());
        String partner=partnerLogin.path("token").asText();
        request("GET","/workspace",null,partner,403);
        assertTrue(partnerPin.matches("[0-9]{6}"));
        partner=change(partner,partnerPin,"654321");
        workspace=request("GET","/workspace",null,partner,200);
        assertEquals(1,workspace.path("projects").size());
        assertFalse(workspace.path("projects").get(0).path("partners").get(0).has("mobile"));
        String partnerId=partnerLogin.path("account").path("identityId").asText();
        command("partner.update",Map.of("projectId",projectA,"partnerId",partnerId,"revision",1,"name","Scoped partner"),partner,403);
        command("partner.update",Map.of("projectId",projectA,"partnerId",partnerId,"revision",1,"name","Scoped partner"),accountant,200);
        command("partner.update",Map.of("projectId",projectA,"partnerId",partnerId,"revision",1,"name","Stale name"),accountant,409);
        assertEquals("Scoped partner",request("GET","/workspace",null,partner,200).path("projects").get(0).path("partners").get(0).path("displayName").asText());
        assertEquals("Test partner",jdbc.queryForObject("SELECT display_name FROM sos.identities WHERE id=?::uuid",String.class,partnerId));
        command("partner.status",Map.of("projectId",projectA,"partnerId",partnerId,"revision",2,"enabled",false),accountant,200);
        request("GET","/workspace",null,partner,401);
        command("partner.status",Map.of("projectId",projectA,"partnerId",partnerId,"revision",3,"enabled",true),accountant,200);
        assertEquals(1,request("GET","/workspace",null,partner,200).path("projects").size());
        command("firm.update",Map.of("firmId",firmA,"revision",1,"name","Test firm A","status","ACTIVE",
            "metadata",Map.of("location","Verified location","officeAddress","Verified address")),owner,200);
        assertEquals("Verified location",request("GET","/workspace",null,accountant,200).path("firms").get(0).path("metadata").path("location").asText());
        command("firm.update",Map.of("firmId",firmA,"revision",2,"name","Test firm A","status","ACTIVE",
            "metadata",Map.of("unrecognizedField","must not disappear")),owner,400);
        assertEquals(1,workspace.path("interfaces").get(0).path("configuration").path("interfaces").size());
        command("project.create",Map.of("sectorId",sectorId,"name","Role escalation"),partner,403);
        JsonNode firmB=command("firm.create",Map.of("name","Test firm B","clientCode","TEST-B","accountantName","Existing accountant",
            "accountantMobile","9888880001","assignments",java.util.List.of(assignment)),owner,200);
        assertTrue(firmB.path("access").path("reused").asBoolean());
        assertFalse(firmB.path("access").has("temporaryCredential"));
        JsonNode secondLogin=login("CLIENT","9888880001","012345","TEST-B",200);
        assertFalse(secondLogin.path("account").path("mustChangeCredential").asBoolean());
        String accountantB=secondLogin.path("token").asText();
        String projectB=command("project.create",Map.of("sectorId",sectorId,"name","Firm B project","details",details),accountantB,200).path("entity").path("id").asText();
        JsonNode resetFixture=command("partner.add",Map.of("projectId",projectB,"name","Reset fixture","mobile","9888880066"),accountantB,200);
        String resetIdentity=resetFixture.path("entity").path("identityId").asText();
        String initial=resetFixture.path("access").path("temporaryCredential").asText();
        JsonNode resetFixtureLogin=login("CLIENT","9888880066",initial,"TEST-B",200);
        String resetFixtureToken=request("POST","/auth/credential",Map.of("currentCredential",initial,"newCredential","669988"),resetFixtureLogin.path("token").asText(),200).path("token").asText();
        command("credentials.reset",Map.of("projectId",projectB,"identityId",resetIdentity),accountant,403);
        command("credentials.reset",Map.of("projectId",projectB,"identityId",resetIdentity),resetFixtureToken,403);
        command("credentials.reset",Map.of("projectId",projectB,"identityId",secondLogin.path("account").path("identityId").asText()),accountantB,403);
        JsonNode accountantReset=command("credentials.reset",Map.of("projectId",projectB,"identityId",resetIdentity),accountantB,200);
        assertTrue(accountantReset.path("access").path("temporaryCredential").asText().matches("[0-9]{6}"));
        request("GET","/workspace",null,resetFixtureToken,401);
        assertTrue(login("CLIENT","9888880066",accountantReset.path("access").path("temporaryCredential").asText(),"TEST-B",200).path("account").path("mustChangeCredential").asBoolean());
        command("project.update",Map.of("projectId",projectB,"revision",1,"status","ACTIVE","name","Cross tenant"),accountant,403);
        assertEquals(1,request("GET","/workspace",null,accountant,200).path("projects").size());
        JsonNode reused=command("partner.add",Map.of("projectId",projectB,"name","Existing partner","mobile","9888880002"),accountantB,200);
        assertTrue(reused.path("access").path("reused").asBoolean());
        assertFalse(reused.path("access").has("temporaryCredential"));
        // A shared identity must not bring another company's projects into this session.
        assertEquals(1,request("GET","/workspace",null,partner,200).path("projects").size());
        JsonNode partnerBLogin=login("CLIENT","9888880002","654321","TEST-B",200);
        String partnerB=partnerBLogin.path("token").asText();
        assertEquals(firmB.path("entity").path("id").asText(),partnerBLogin.path("account").path("firmId").asText());
        assertEquals(projectB,request("GET","/workspace",null,partnerB,200).path("projects").get(0).path("id").asText());
        // Role precedence applies only to memberships actually granted by the database.
        command("partner.add",Map.of("projectId",projectA,"name","Accountant also participating","mobile","9888880001"),accountant,200);
        assertEquals("ACCOUNTANT",login("CLIENT","9888880001","012345","TEST-A",200).path("account").path("role").asText());
        // A reviewed upgrade changes only the release assignment, not existing projects or credentials.
        String erpRelease=jdbc.queryForObject("SELECT r.id::text FROM sos.sector_releases r JOIN sos.project_setup_definitions d ON d.release_id=r.id WHERE r.sector_id=?::uuid AND r.state='PUBLISHED' AND d.definition->>'presentation' IS DISTINCT FROM 'open-plotting-simple' ORDER BY r.version DESC LIMIT 1",String.class,sectorId);
        command("firm.assignSector",Map.of("firmId",firmA,"sectorId",sectorId,"releaseId",erpRelease,"enabled",true),owner,200);
        verifyErp(accountant,partner,partnerB,projectA,partnerCreated.path("entity").path("identityId").asText());
        verifyCompleteSetup(owner,accountant,partner,partnerB,firmA,other.path("id").asText(),
            partnerCreated.path("entity").path("identityId").asText());
        command("firm.update",Map.of("firmId",firmA,"name","Test firm A","status","SUSPENDED","revision",2),owner,200);
        request("POST","/auth/company",Map.of("clientCode","TEST-A"),null,404);
        request("GET","/workspace",null,accountant,401);
        request("GET","/workspace",null,partner,401);
        assertEquals(1,request("GET","/workspace",null,partnerB,200).path("projects").size());
        assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM sos.projects",Integer.class));
        ObjectNode published=(ObjectNode)request("GET","/configuration/"+releaseId,null,owner,200);
        command("configuration.save",published,owner,409);
        ObjectNode clone=published.deepCopy(); clone.remove(java.util.List.of("releaseId","version","revision","state"));
        clone.put("label","New version");
        JsonNode saved=command("configuration.save",clone,owner,200).path("entity");
        String draftId=saved.path("releaseId").asText();
        command("configuration.publish",Map.of("releaseId",draftId,"revision",1),owner,200);
        command("configuration.publish",Map.of("releaseId",draftId,"revision",1),owner,409);
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("UPDATE sos.sector_interfaces SET title='Forbidden mutation' WHERE release_id=?::uuid",draftId));
        command("firm.assignSector",Map.of("firmId",firmB.path("entity").path("id").asText(),"sectorId",sectorId,"releaseId",draftId,"enabled",false),owner,200);
        command("project.create",Map.of("sectorId",sectorId,"name","Disabled assignment"),accountantB,403);
        assertEquals(1,request("GET","/workspace",null,accountantB,200).path("projects").size());
        String oldPartner=partnerB;
        JsonNode reset=command("credentials.reset",Map.of("identityId",partnerCreated.path("entity").path("identityId").asText()),owner,200);
        request("GET","/workspace",null,oldPartner,401);
        assertTrue(login("CLIENT","9888880002",reset.path("access").path("temporaryCredential").asText(),"TEST-B",200).path("account").path("mustChangeCredential").asBoolean());
        request("POST","/auth/logout",null,owner,200);
        request("GET","/auth/me",null,owner,401);
    }
    private void verifyCompleteSetup(String owner,String accountant,String partner,String outsider,String firm,String sector,String partnerId) throws Exception {
        String release=jdbc.queryForObject("SELECT id::text FROM sos.sector_releases WHERE sector_id=?::uuid AND state='PUBLISHED' ORDER BY version DESC LIMIT 1",String.class,sector);
        command("firm.assignSector",Map.of("firmId",firm,"sectorId",sector,"releaseId",release,"enabled",true),owner,200);
        JsonNode manifest=request("GET","/workspace",null,accountant,200);
        assertTrue(manifest.path("interfaces").findValues("projectSetup").size()>0);
        var setup=json.createObjectNode();
        setup.putObject("values").put("name","Isolated setup project").put("projectCode","SETUP-1")
            .put("developmentStage","active_sales").put("startDate","2026-10-09").put("location","Integration test location")
            .put("totalEstimatedOutlay",1000).put("extentValue",1).put("extentUnit","Acres").put("roadWidth","30").put("floorRatePerSqYard",10);
        setup.putObject("settings").put("equitySplitMode","fixed").put("autoGenerateInventory",true);
        setup.putArray("groups").addObject().put("count",2).put("areaSqYards",100).put("facing","Commercial")
            .put("startNumber",1).put("ratePerSqYard",11);
        String mobile=jdbc.queryForObject("SELECT mobile FROM sos.identities WHERE id=?::uuid",String.class,partnerId);
        setup.putArray("partners").addObject().put("name","Reused integration partner").put("mobile",mobile)
            .put("userRole","investor_partner").put("fixedEquityPercent",100).put("initialCapital",1000);
        setup.putArray("accounts").addObject().put("accountName","Isolated treasury").put("accountType","current_operational")
            .put("bankName","State Bank of India").put("accountNumber","1234567890").put("ifscCode","SBIN0001234")
            .put("openingBalance",1000).put("openingBalanceDate","2026-10-09").put("status","active");
        setup.putArray("documents");
        var input=json.createObjectNode().put("sectorId",sector).put("requestId",java.util.UUID.randomUUID().toString());input.set("setup",setup);
        assertEquals("open-plotting-simple",jdbc.queryForObject("SELECT definition->>'presentation' FROM sos.project_setup_definitions WHERE release_id=?::uuid",String.class,release));
        var overBudget=input.deepCopy().put("requestId",java.util.UUID.randomUUID().toString());
        ((com.fasterxml.jackson.databind.node.ObjectNode)overBudget.path("setup").path("partners").get(0)).put("initialCapital",2000);
        command("project.setup-save",overBudget,accountant,400);
        var badIfsc=input.deepCopy().put("requestId",java.util.UUID.randomUUID().toString());
        ((com.fasterxml.jackson.databind.node.ObjectNode)badIfsc.path("setup").path("accounts").get(0)).put("ifscCode","NOT-AN-IFSC");
        command("project.setup-save",badIfsc,accountant,400);
        int projectsBefore=jdbc.queryForObject("SELECT count(*) FROM sos.projects",Integer.class);
        var incomplete=input.deepCopy().put("requestId",java.util.UUID.randomUUID().toString());
        ((ObjectNode)incomplete.path("setup").path("partners").get(0)).put("fixedEquityPercent",50).put("initialCapital",500);
        command("project.setup-create",incomplete,accountant,400);
        assertEquals(projectsBefore,jdbc.queryForObject("SELECT count(*) FROM sos.projects",Integer.class),
            "A failed atomic create must not leave a draft or child records.");
        JsonNode saved=command("project.setup-save",input,accountant,200);
        String id=saved.path("entity").path("id").asText();
        assertEquals(id,command("project.setup-save",input,accountant,200).path("entity").path("id").asText());
        HttpHeaders uploadHeaders=new HttpHeaders();
        uploadHeaders.setBearerAuth(accountant);
        uploadHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);
        var uploadBody=new org.springframework.util.LinkedMultiValueMap<String,Object>();
        HttpHeaders fileHeaders=new HttpHeaders();fileHeaders.setContentType(MediaType.APPLICATION_PDF);
        uploadBody.add("file",new HttpEntity<>(new org.springframework.core.io.ByteArrayResource(
            "%PDF-1.4\nDisposable integration-test document\n".getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
                @Override public String getFilename() { return "project-plan.pdf"; }
            },fileHeaders));
        ResponseEntity<String> uploaded=http.exchange("/api/erp/"+id+"/attachments",HttpMethod.POST,
            new HttpEntity<>(uploadBody,uploadHeaders),String.class);
        assertEquals(200,uploaded.getStatusCode().value(),uploaded.getBody());
        String attachmentId;
        try { attachmentId=json.readTree(uploaded.getBody()).path("id").asText(); }
        catch(Exception error) { throw new AssertionError(error); }
        assertFalse(attachmentId.isBlank());
        String category=jdbc.queryForObject("""
            SELECT f->'options'->>0 FROM sos.erp_resources r
            CROSS JOIN LATERAL jsonb_array_elements(r.fields) f
            WHERE r.release_id=?::uuid AND r.kind='documents' AND f->>'key'='category'
            """,String.class,release);
        setup.withArray("documents").addObject().put("title","Uploaded project plan")
            .put("category",category).put("attachmentId",attachmentId);
        request("GET","/erp/"+id,null,accountant,400);
        request("GET","/erp/"+id,null,outsider,403);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid",Integer.class,id));
        // Invalid generation rolls back membership provisioning and every other child.
        ((com.fasterxml.jackson.databind.node.ObjectNode)setup.path("groups").get(0)).put("ratePerSqYard",1);
        var changed=input.deepCopy().put("projectId",id).put("revision",1).put("requestId",java.util.UUID.randomUUID().toString());changed.set("setup",setup);
        command("project.setup-save",changed,accountant,200);
        command("project.setup-finalize",Map.of("projectId",id,"revision",2,"requestId",java.util.UUID.randomUUID().toString()),accountant,400);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.project_memberships WHERE project_id=?::uuid",Integer.class,id));
        ((com.fasterxml.jackson.databind.node.ObjectNode)setup.path("groups").get(0)).put("ratePerSqYard",11);
        changed.put("revision",2).put("requestId",java.util.UUID.randomUUID().toString());
        command("project.setup-save",changed,accountant,200);
        Object finalizeInput=Map.of("projectId",id,"revision",3,"requestId",java.util.UUID.randomUUID().toString());
        JsonNode complete=command("project.setup-finalize",finalizeInput,accountant,200);
        assertEquals(2,complete.path("entity").path("counts").path("inventory").asInt());
        assertTrue(complete.path("entity").path("access").get(0).path("reused").asBoolean());
        command("project.setup-finalize",finalizeInput,accountant,200);
        assertEquals(6,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid",Integer.class,id));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.project_cash_accounts WHERE project_id=?::uuid",Integer.class,id));
        assertEquals(1,complete.path("entity").path("counts").path("documents").asInt());
        assertEquals(attachmentId,jdbc.queryForObject("SELECT data->>'attachmentId' FROM sos.erp_records WHERE project_id=?::uuid AND kind='documents'",String.class,id));
        JsonNode erp=request("GET","/erp/"+id,null,accountant,200);
        var profileData=json.createObjectNode().put("partnerId",partnerId).put("userRole","investor_partner")
            .put("fixedEquityPercent",100).put("initialCapital",2000);
        String profile=jdbc.queryForObject("SELECT id::text FROM sos.erp_records WHERE project_id=?::uuid AND kind='partner-profiles'",String.class,id);
        command("erp.save",Map.of("projectId",id,"kind","partner-profiles","recordId",profile,"revision",1,
            "requestId",java.util.UUID.randomUUID().toString(),"data",profileData),accountant,400);
        assertEquals("1000",jdbc.queryForObject("SELECT data->>'initialCapital' FROM sos.erp_records WHERE id=?::uuid",String.class,profile).split("\\.")[0]);
        // A reviewed live project preserves its historical setup, even when
        // the new form uses sequential numbering and stricter bank validation.
        var historical=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(jdbc.queryForObject(
            "SELECT data::text FROM sos.project_setup_sections WHERE project_id=?::uuid",String.class,id));
        ((com.fasterxml.jackson.databind.node.ObjectNode)historical.path("groups").get(0)).put("startNumber",30);
        ((com.fasterxml.jackson.databind.node.ObjectNode)historical.path("accounts").get(0)).put("ifscCode","legacy-ifsc");
        jdbc.update("UPDATE sos.project_setup_sections SET data=?::jsonb WHERE project_id=?::uuid",historical.toString(),id);
        ((com.fasterxml.jackson.databind.node.ObjectNode)historical.path("values")).put("name","Reviewed live project");
        ((ObjectNode)historical.path("values")).put("notes","Editable project note");
        ((ObjectNode)historical.path("settings")).put("autoGenerateInventory",false);
        // Changing the firm's release must not silently migrate or strand an
        // operational project's previously saved setup contract.
        ObjectNode upgraded=(ObjectNode)request("GET","/configuration/"+release,null,owner,200);
        upgraded.remove(java.util.List.of("releaseId","version","revision","state"));
        upgraded.put("label","New firm release after project completion");
        String nextRelease=command("configuration.save",upgraded,owner,200).path("entity").path("releaseId").asText();
        command("configuration.publish",Map.of("releaseId",nextRelease,"revision",1),owner,200);
        command("firm.assignSector",Map.of("firmId",firm,"sectorId",sector,"releaseId",nextRelease,"enabled",true),owner,200);
        JsonNode upgradedWorkspace=request("GET","/workspace",null,accountant,200);
        JsonNode pinnedProject=null;
        for(JsonNode row:upgradedWorkspace.path("projects")) if(id.equals(row.path("id").asText())) pinnedProject=row;
        assertNotNull(pinnedProject);
        assertEquals(release,pinnedProject.path("setupReleaseId").asText());
        assertTrue(pinnedProject.path("setupDefinition").path("sections").isArray());
        int liveRevision=jdbc.queryForObject("SELECT revision FROM sos.projects WHERE id=?::uuid",Integer.class,id);
        command("project.setup-save",Map.of("projectId",id,"sectorId",sector,"revision",liveRevision,
            "setupReleaseId",release,"requestId",java.util.UUID.randomUUID().toString(),"setup",historical),accountant,200);
        assertEquals(release,jdbc.queryForObject("SELECT setup_release_id::text FROM sos.projects WHERE id=?::uuid",String.class,id));
        JsonNode preserved=json.readTree(jdbc.queryForObject("SELECT data::text FROM sos.project_setup_sections WHERE project_id=?::uuid",String.class,id));
        assertEquals(historical.path("groups"),preserved.path("groups"));
        assertEquals(historical.path("accounts"),preserved.path("accounts"));
        assertEquals(6,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid",Integer.class,id));
        assertEquals("Editable project note",jdbc.queryForObject("SELECT details->>'notes' FROM sos.projects WHERE id=?::uuid",String.class,id));
        JsonNode liveSettings=json.readTree(jdbc.queryForObject("SELECT data::text FROM sos.erp_project_settings WHERE project_id=?::uuid",String.class,id));
        assertFalse(liveSettings.path("autoGenerateInventory").asBoolean(true));
        assertEquals("Reviewed live project",liveSettings.path("projectPlan").path("values").path("name").asText());
        // Clearing an optional field must not resurrect its previous value.
        ((ObjectNode)historical.path("values")).put("notes","");
        command("project.setup-save",Map.of("projectId",id,"sectorId",sector,"revision",liveRevision+1,
            "requestId",java.util.UUID.randomUUID().toString(),"setup",historical),accountant,200);
        assertFalse(jdbc.queryForObject("SELECT jsonb_exists(details,'notes') FROM sos.projects WHERE id=?::uuid",Boolean.class,id));
        assertEquals(6,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid",Integer.class,id));
        command("project.setup-save",Map.of("projectId",id,"sectorId",sector,"revision",liveRevision+1,
            "requestId",java.util.UUID.randomUUID().toString(),"setup",historical),accountant,409);
        command("project.setup-save",Map.of("projectId",id,"sectorId",sector,"revision",liveRevision+2,
            "setupReleaseId",nextRelease,"requestId",java.util.UUID.randomUUID().toString(),"setup",historical),accountant,409);
        command("firm.assignSector",Map.of("firmId",firm,"sectorId",sector,"releaseId",release,"enabled",true),owner,200);
        String acct=jdbc.queryForObject("SELECT r.id::text FROM sos.erp_records r JOIN sos.project_cash_accounts c ON c.project_id=r.project_id WHERE r.project_id=?::uuid AND r.kind='accounts' AND r.id<>c.account_record_id",String.class,id);
        assertEquals("1000.00",accountBalance(erp,acct));
        String plot=jdbc.queryForObject("SELECT id::text FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' LIMIT 1",String.class,id);
        ObjectNode originalPlot=(ObjectNode)json.readTree(jdbc.queryForObject("SELECT data::text FROM sos.erp_records WHERE id=?::uuid",String.class,plot));
        String secondPlot=jdbc.queryForObject("SELECT id::text FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND id<>?::uuid LIMIT 1",String.class,id,plot);
        ObjectNode secondPlotData=(ObjectNode)json.readTree(jdbc.queryForObject("SELECT data::text FROM sos.erp_records WHERE id=?::uuid",String.class,secondPlot));
        ObjectNode editedPlot=originalPlot.deepCopy().put("areaSqYards",120).put("ratePerSqYard",12)
            .put("roadWidthFt",24).put("notes","Edited inside project form");
        ObjectNode plotRequest=json.createObjectNode().put("projectId",id).put("sectorId",sector)
            .put("revision",liveRevision+2).put("requestId",java.util.UUID.randomUUID().toString());
        plotRequest.set("setup",historical.deepCopy());
        plotRequest.putArray("plotEdits").addObject().put("recordId",plot).put("revision",1).set("data",editedPlot);
        assertEquals(1,command("project.setup-save",plotRequest,accountant,200).path("entity").path("updatedPlots").asInt());
        command("project.setup-save",plotRequest,accountant,200);
        assertEquals(2,jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Integer.class,plot));
        assertEquals(0,new java.math.BigDecimal("120").compareTo(jdbc.queryForObject("SELECT (data->>'areaSqYards')::numeric FROM sos.erp_records WHERE id=?::uuid",java.math.BigDecimal.class,plot)));
        assertEquals("1000.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        ObjectNode failedBatch=plotRequest.deepCopy().put("revision",liveRevision+3).put("requestId",java.util.UUID.randomUUID().toString());
        ((ObjectNode)failedBatch.path("setup").path("values")).put("name","Must roll back");
        var changes=failedBatch.putArray("plotEdits");
        changes.addObject().put("recordId",plot).put("revision",2).set("data",editedPlot.deepCopy().put("areaSqYards",125));
        changes.addObject().put("recordId",secondPlot).put("revision",2).set("data",secondPlotData);
        command("project.setup-save",failedBatch,accountant,409);
        assertEquals("Reviewed live project",jdbc.queryForObject("SELECT name FROM sos.projects WHERE id=?::uuid",String.class,id));
        assertEquals(liveRevision+3,jdbc.queryForObject("SELECT revision FROM sos.projects WHERE id=?::uuid",Integer.class,id));
        assertEquals(0,new java.math.BigDecimal("120").compareTo(jdbc.queryForObject("SELECT (data->>'areaSqYards')::numeric FROM sos.erp_records WHERE id=?::uuid",java.math.BigDecimal.class,plot)));
        assertEquals(2,jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Integer.class,plot));
        assertEquals(6,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid",Integer.class,id));
        ObjectNode restorePlot=plotRequest.deepCopy().put("revision",liveRevision+3).put("requestId",java.util.UUID.randomUUID().toString());
        restorePlot.putArray("plotEdits").addObject().put("recordId",plot).put("revision",2).set("data",originalPlot);
        command("project.setup-save",restorePlot,accountant,200);
        Object booking=Map.of("projectId",id,"kind","bookings","requestId",java.util.UUID.randomUUID().toString(),
            "data",Map.of("inventoryId",plot,"buyerName","Integration buyer","buyerPhone","9888880099","advanceReceived","100.00",
                "ratePerSqYard","11.00","accountId",acct,"paymentMode","UPI","date","2026-10-09"));
        String bookingId=command("erp.save",booking,accountant,200).path("entity").path("id").asText();
        command("erp.save",Map.of("projectId",id,"kind","bookings","requestId",java.util.UUID.randomUUID().toString(),
            "data",((Map<?,?>)booking).get("data")),accountant,409);
        assertEquals("1000.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        command("erp.review",Map.of("projectId",id,"recordId",bookingId,"revision",1,"decision","approved"),accountant,400);
        command("erp.review",Map.of("projectId",id,"recordId",bookingId,"revision",1,"decision","approved"),partner,200);
        assertEquals("1100.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        ObjectNode protectedRequest=plotRequest.deepCopy().put("revision",liveRevision+4)
            .put("requestId",java.util.UUID.randomUUID().toString());
        ((ObjectNode)protectedRequest.path("setup").path("values")).put("name","Booked edit must roll back");
        protectedRequest.putArray("plotEdits").addObject().put("recordId",plot)
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Integer.class,plot))
            .set("data",originalPlot.deepCopy().put("status","reserved").put("areaSqYards",999));
        command("project.setup-save",protectedRequest,accountant,400);
        assertEquals("Reviewed live project",jdbc.queryForObject("SELECT name FROM sos.projects WHERE id=?::uuid",String.class,id));
        assertEquals(0,new java.math.BigDecimal("100").compareTo(jdbc.queryForObject("SELECT (data->>'areaSqYards')::numeric FROM sos.erp_records WHERE id=?::uuid",java.math.BigDecimal.class,plot)));
        assertEquals("1100.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        exerciseMatrixEditor(id,sector,accountant,historical,acct,plot);
        exerciseBlueprint(id,accountant,partner,outsider,partnerId,plot);
        String otherPlot=jdbc.queryForObject("SELECT id::text FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted' AND id<>?::uuid LIMIT 1",String.class,id,plot);
        Map<String,Object> lifecycleData=Map.of("inventoryId",otherPlot,"buyerName","Lifecycle test buyer","buyerPhone","9888880099",
            "advanceReceived","0.00","ratePerSqYard","11.00","accountId",acct,"paymentMode","UPI","date","2026-10-09");
        String deletedBooking=saveRecord(accountant,id,"bookings",lifecycleData);
        command("erp.delete",Map.of("projectId",id,"recordId",deletedBooking,"revision",1),accountant,200);
        assertEquals("released",jdbc.queryForObject("SELECT state FROM sos.erp_inventory_reservations WHERE booking_id=?::uuid",String.class,deletedBooking));
        String rejectedBooking=saveRecord(accountant,id,"bookings",lifecycleData);
        command("erp.review",Map.of("projectId",id,"recordId",rejectedBooking,"revision",1,"decision","rejected","reason","Withdrawn for correction"),partner,200);
        assertEquals("released",jdbc.queryForObject("SELECT state FROM sos.erp_inventory_reservations WHERE booking_id=?::uuid",String.class,rejectedBooking));
        command("erp.save",Map.of("projectId",id,"recordId",rejectedBooking,"revision",2,"kind","bookings",
            "requestId",java.util.UUID.randomUUID().toString(),"data",lifecycleData),accountant,200);
        assertEquals("active",jdbc.queryForObject("SELECT state FROM sos.erp_inventory_reservations WHERE booking_id=?::uuid",String.class,rejectedBooking));
        command("erp.save",Map.of("projectId",id,"kind","bookings","requestId",java.util.UUID.randomUUID().toString(),"data",lifecycleData),accountant,409);
        command("erp.delete",Map.of("projectId",id,"recordId",rejectedBooking,"revision",3),accountant,200);
        String competingBooking=saveRecord(accountant,id,"bookings",lifecycleData);
        command("erp.review",Map.of("projectId",id,"recordId",competingBooking,"revision",1,"decision","rejected","reason","Correction required"),partner,200);
        String newCompetitor=saveRecord(accountant,id,"bookings",lifecycleData);
        command("erp.save",Map.of("projectId",id,"recordId",competingBooking,"revision",2,"kind","bookings",
            "requestId",java.util.UUID.randomUUID().toString(),"data",lifecycleData),accountant,409);
        assertEquals("rejected",jdbc.queryForObject("SELECT status FROM sos.erp_records WHERE id=?::uuid",String.class,competingBooking));
        assertEquals("active",jdbc.queryForObject("SELECT state FROM sos.erp_inventory_reservations WHERE booking_id=?::uuid",String.class,newCompetitor));
        assertEquals("1100.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        String expense=saveRecord(partner,id,"expenses",Map.of("partnerId",partnerId,"amount","25.00","category","Misc",
            "date","2026-10-09","note","Individual-funded integration expense","paymentSource","individual","paymentMode","UPI"));
        command("erp.review",Map.of("projectId",id,"recordId",expense,"revision",1,"decision","approved"),accountant,200);
        String reimbursement=saveRecord(partner,id,"reimbursements",Map.of("expenseId",expense,"accountId",acct,"amount","25.00","date","2026-10-09","paymentMode","UPI"));
        command("erp.review",Map.of("projectId",id,"recordId",reimbursement,"revision",1,"decision","approved"),partner,400);
        command("erp.review",Map.of("projectId",id,"recordId",reimbursement,"revision",1,"decision","approved"),accountant,200);
        assertEquals("1075.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid AND ledger_code='expenses'",Integer.class,id));
        command("erp.save",Map.of("projectId",id,"kind","reimbursements","requestId",java.util.UUID.randomUUID().toString(),
            "data",Map.of("expenseId",expense,"accountId",acct,"amount","0.01","date","2026-10-09","paymentMode","UPI")),accountant,400);
    }
    private String saveRecord(String token,String project,String kind,Map<String,Object> data) {
        return command("erp.save",Map.of("projectId",project,"kind",kind,"data",data,"requestId",java.util.UUID.randomUUID().toString()),token,200).path("entity").path("id").asText();
    }
    private String accountBalance(JsonNode erp,String account) {
        for(JsonNode balance:erp.path("balances"))
            if(account.equals(balance.path("accountId").asText())) return balance.path("balance").asText();
        throw new AssertionError("Project account balance is missing.");
    }
    private void verifyErp(String accountant,String partner,String outsider,String project,String partnerId) {
        request("GET","/erp/"+project,null,outsider,403);
        assertTrue(request("GET","/erp/"+project,null,partner,200).path("resources").size()>0);
        String account=saveRecord(accountant,project,"accounts",Map.of("accountName","Project Treasury","accountType","current_operational","openingBalance","0.00","openingBalanceDate","2026-10-09","status","active"));
        String requestId=java.util.UUID.randomUUID().toString();
        Object investment=Map.of("projectId",project,"kind","investments","requestId",requestId,
            "data",Map.of("partnerId",partnerId,"amount","1000.10","accountId",account,"date","2026-10-09","purpose","Initial capital","paymentMode","UPI"));
        String inv=command("erp.save",investment,partner,200).path("entity").path("id").asText();
        assertEquals(inv,command("erp.save",investment,partner,200).path("entity").path("id").asText());
        command("erp.review",Map.of("projectId",project,"recordId",inv,"revision",1,"decision","approved"),partner,400);
        command("erp.review",Map.of("projectId",project,"recordId",inv,"revision",1,"decision","approved"),accountant,200);
        command("erp.review",Map.of("projectId",project,"recordId",inv,"revision",1,"decision","approved"),accountant,409);
        JsonNode erp=request("GET","/erp/"+project,null,accountant,200);
        assertEquals("1000.10",accountBalance(erp,account));
        String expense=saveRecord(partner,project,"expenses",Map.of("partnerId",partnerId,"amount","100.01","date","2026-10-09",
            "category","Material","note","Verified site materials","paymentSource","project_bank","accountId",account,"paymentMode","UPI"));
        command("erp.review",Map.of("projectId",project,"recordId",expense,"revision",1,"decision","approved"),accountant,200);
        assertEquals("900.09",accountBalance(request("GET","/erp/"+project,null,partner,200),account));
        command("erp.delete",Map.of("projectId",project,"recordId",expense,"revision",2),accountant,403);
        String overdraft=saveRecord(partner,project,"drawings",Map.of("partnerId",partnerId,"amount","901.00","date","2026-10-09",
            "accountId",account,"payoutMode","Bank Transfer","destinationAccountDetails","Personal account","purpose","Overdraft check"));
        command("erp.review",Map.of("projectId",project,"recordId",overdraft,"revision",1,"decision","approved"),accountant,400);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_approvals WHERE record_id=?::uuid",Integer.class,overdraft));
        String unit=saveRecord(accountant,project,"units",Map.of("unitNumber","101","floor",1,"flatType","2 BHK","sftArea",1000,"facing","East","baseRate",5000,"status","available"));
        String booking=saveRecord(partner,project,"bookings",Map.of("inventoryId",unit,"buyerName","Test buyer","buyerPhone","9000000099",
            "advanceReceived","50.02","accountId",account,"paymentMode","UPI","date","2026-10-09"));
        command("erp.review",Map.of("projectId",project,"recordId",booking,"revision",1,"decision","approved"),accountant,200);
        assertEquals("booked",jdbc.queryForObject("SELECT data->>'status' FROM sos.erp_records WHERE id=?::uuid",String.class,unit));
        assertEquals("950.11",accountBalance(request("GET","/erp/"+project,null,partner,200),account));
        command("erp.inventory-stage",Map.of("projectId",project,"recordId",unit,"revision",2,"status","registered","currentMilestone","Handover"),partner,403);
        command("erp.inventory-stage",Map.of("projectId",project,"recordId",unit,"revision",2,"status","registered","currentMilestone","Handover"),accountant,200);
        String cash=jdbc.queryForObject("SELECT account_record_id::text FROM sos.project_cash_accounts WHERE project_id=?::uuid",String.class,project);
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.project_cash_accounts WHERE project_id=?::uuid",Integer.class,project));
        assertEquals(false,jdbc.queryForObject("SELECT jsonb_exists(data,'accountNumber') FROM sos.erp_records WHERE id=?::uuid",Boolean.class,cash));
        command("erp.delete",Map.of("projectId",project,"recordId",cash,"revision",1),accountant,400);
        command("erp.save",Map.of("projectId",project,"kind","investments","requestId",java.util.UUID.randomUUID().toString(),
            "data",Map.of("partnerId",partnerId,"amount","10.00","accountId",cash,"date","2026-10-09","purpose","Non-cash guard","paymentMode","UPI")),partner,400);
        String otherCash=jdbc.queryForObject("SELECT account_record_id::text FROM sos.project_cash_accounts WHERE project_id<>?::uuid LIMIT 1",String.class,project);
        command("erp.save",Map.of("projectId",project,"kind","investments","requestId",java.util.UUID.randomUUID().toString(),
            "data",Map.of("partnerId",partnerId,"amount","10.00","accountId",otherCash,"date","2026-10-09","purpose","Project isolation guard","paymentMode","Cash")),partner,403);
        String cashRequest=java.util.UUID.randomUUID().toString();
        Object cashInput=Map.of("projectId",project,"kind","investments","requestId",cashRequest,
            "data",Map.of("partnerId",partnerId,"amount","125.00","accountId",account,"date","2026-10-09","purpose","Cash capital","paymentMode","Cash"));
        String cashInvestment=command("erp.save",cashInput,partner,200).path("entity").path("id").asText();
        assertEquals(cashInvestment,command("erp.save",cashInput,partner,200).path("entity").path("id").asText());
        assertEquals(cash,jdbc.queryForObject("SELECT account_id::text FROM sos.erp_records WHERE id=?::uuid",String.class,cashInvestment));
        command("erp.review",Map.of("projectId",project,"recordId",cashInvestment,"revision",1,"decision","approved"),accountant,200);
        String cashExpense=saveRecord(partner,project,"expenses",Map.of("partnerId",partnerId,"amount","25.00","date","2026-10-09",
            "category","Material","note","Cash paid materials","paymentSource","project_bank","paymentMode","Cash / Spot Voucher"));
        assertEquals(cash,jdbc.queryForObject("SELECT account_id::text FROM sos.erp_records WHERE id=?::uuid",String.class,cashExpense));
        command("erp.review",Map.of("projectId",project,"recordId",cashExpense,"revision",1,"decision","approved"),accountant,200);
        assertEquals(new java.math.BigDecimal("100.00"),jdbc.queryForObject("SELECT sum(debit-credit) FROM sos.erp_postings WHERE account_id=?::uuid AND ledger_code='bank'",java.math.BigDecimal.class,cash));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM sos.project_cash_accounts WHERE project_id=?::uuid",Integer.class,project));
        command("erp.settings",Map.of("projectId",project,"revision",0,"settings",Map.of("equitySplitMode","proportional",
            "projectPlan",Map.of("units",Map.of("floorsCount","1","flats",java.util.List.of())))),accountant,200);
        assertEquals("100.0000",request("GET","/erp/"+project,null,partner,200).path("partners").get(1).path("equityPercent").asText());
        assertEquals(0,jdbc.queryForObject("""
            SELECT count(*) FROM (SELECT record_id FROM sos.erp_postings GROUP BY record_id HAVING sum(debit)<>sum(credit)) x
            """,Integer.class));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("UPDATE sos.erp_postings SET debit=0 WHERE record_id=?::uuid",inv));
        command("erp.bulk-save",Map.of("projectId",project,"kind","units","requestId",java.util.UUID.randomUUID().toString(),"records",java.util.List.of(
            Map.of("unitNumber","102","floor",1,"flatType","2 BHK","sftArea",1000,"facing","East","baseRate",5000,"status","available"),
            Map.of("unitNumber","101","floor",1,"flatType","2 BHK","sftArea",1000,"facing","East","baseRate",5000,"status","available"))),accountant,400);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE data->>'unitNumber'='102'",Integer.class));
        ObjectNode config=(ObjectNode)request("GET","/configuration/"+jdbc.queryForObject(
            "SELECT release_id::text FROM sos.firm_sector_assignments WHERE firm_id=(SELECT firm_id FROM sos.projects WHERE id=?::uuid)",String.class,project),null,
            login("OWNER","9888880000","Owner-updated-123","",200).path("token").asText(),200);
        assertTrue(config.path("resources").size()>0);
    }
    private ObjectNode matrixSnapshot(String project) throws Exception {
        ObjectNode matrix=json.createObjectNode();
        var rows=jdbc.queryForList("SELECT id::text AS id,revision,data::text AS data FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted'",project);
        var revisions=matrix.putArray("records");
        Map<String,Integer> counts=new java.util.LinkedHashMap<>();
        for(String key:java.util.List.of("east","north","west","south","corner","commercial")) counts.put(key,0);
        for(var row:rows) {
            revisions.addObject().put("recordId",row.get("id").toString()).put("revision",(Integer)row.get("revision"));
            String facing=json.readTree(row.get("data").toString()).path("facing").asText();
            String key=facing.contains("Corner")?"corner":facing.toLowerCase();
            counts.put(key,counts.get(key)+1);
        }
        var groups=matrix.putArray("groups");
        counts.forEach((key,count)->groups.addObject().put("key",key).put("count",count).putNull("areaSqYards"));
        return matrix;
    }
    private void exerciseMatrixEditor(String id,String sector,String accountant,ObjectNode historical,String acct,String booked) throws Exception {
        int plotCount=jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted'",Integer.class,id);
        int bankCount=jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='accounts'",Integer.class,id);
        String facing=jdbc.queryForObject("SELECT data->>'facing' FROM sos.erp_records WHERE id=?::uuid",String.class,booked);
        String groupKey=facing.contains("Corner")?"corner":facing.toLowerCase();
        ObjectNode save=json.createObjectNode().put("projectId",id).put("sectorId",sector)
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.projects WHERE id=?::uuid",Integer.class,id))
            .put("requestId",java.util.UUID.randomUUID().toString());
        save.set("setup",historical.deepCopy());save.set("plotMatrix",matrixSnapshot(id));
        ObjectNode group=matrixGroup(save.path("plotMatrix"),groupKey);
        int groupCount=group.path("count").asInt();
        group.put("count",groupCount+1).put("areaSqYards",150);
        ObjectNode bank=(ObjectNode)json.readTree(jdbc.queryForObject("SELECT data::text FROM sos.erp_records WHERE id=?::uuid",String.class,acct));
        var accounts=save.putArray("accountEdits");
        accounts.addObject().put("recordId",acct)
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Integer.class,acct))
            .set("data",bank.deepCopy().put("bankName","Updated bank"));
        accounts.addObject().set("data",bank.deepCopy().put("accountName","Additional bank")
            .put("accountNumber","000077771234").put("openingBalance",0).put("isPrimary",false));
        long before=jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid",Long.class,id);
        command("project.setup-save",save,accountant,200);
        command("project.setup-save",save,accountant,200);
        assertEquals(plotCount+1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted'",Integer.class,id));
        assertEquals(bankCount+1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='accounts'",Integer.class,id));
        assertEquals(before,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid",Long.class,id));
        assertEquals("Updated bank",jdbc.queryForObject("SELECT data->>'bankName' FROM sos.erp_records WHERE id=?::uuid",String.class,acct));
        assertEquals(0,new java.math.BigDecimal("100").compareTo(jdbc.queryForObject("SELECT (data->>'areaSqYards')::numeric FROM sos.erp_records WHERE id=?::uuid",java.math.BigDecimal.class,booked)));
        assertEquals("1100.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
        ObjectNode invalid=save.deepCopy().put("requestId",java.util.UUID.randomUUID().toString())
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.projects WHERE id=?::uuid",Integer.class,id));
        invalid.set("plotMatrix",matrixSnapshot(id));
        matrixGroup(invalid.path("plotMatrix"),groupKey).put("count",groupCount+2).put("areaSqYards",175);
        invalid.remove("accountEdits");
        invalid.putArray("accountEdits").addObject().put("recordId",acct)
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Integer.class,acct))
            .set("data",bank.deepCopy().put("openingBalance",2000));
        command("project.setup-save",invalid,accountant,400);
        assertEquals(plotCount+1,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted'",Integer.class,id));
        assertEquals(before,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid",Long.class,id));
        ObjectNode shrink=save.deepCopy().put("requestId",java.util.UUID.randomUUID().toString())
            .put("revision",jdbc.queryForObject("SELECT revision FROM sos.projects WHERE id=?::uuid",Integer.class,id));
        shrink.remove("accountEdits");shrink.set("plotMatrix",matrixSnapshot(id));
        matrixGroup(shrink.path("plotMatrix"),groupKey).put("count",0);
        command("project.setup-save",shrink,accountant,400);
        // Restore the original available count/size for the subsequent lifecycle tests.
        shrink.put("requestId",java.util.UUID.randomUUID().toString());
        matrixGroup(shrink.path("plotMatrix"),groupKey).put("count",groupCount).put("areaSqYards",100);
        command("project.setup-save",shrink,accountant,200);
        assertEquals(plotCount,jdbc.queryForObject("SELECT count(*) FROM sos.erp_records WHERE project_id=?::uuid AND kind='plots' AND status<>'deleted'",Integer.class,id));
        assertEquals("1100.00",accountBalance(request("GET","/erp/"+id,null,accountant,200),acct));
    }
    private ObjectNode matrixGroup(JsonNode matrix,String key) {
        return (ObjectNode)matrix.path("groups").findParents("key").stream()
            .filter(group->key.equals(group.path("key").asText())).findFirst().orElseThrow();
    }
    private void exerciseBlueprint(String id,String accountant,String partner,String outsider,String identity,String plot) throws Exception {
        String attachment=java.util.UUID.randomUUID().toString();
        jdbc.update("INSERT INTO sos.erp_attachments(id,project_id,uploaded_by,file_name,content_type,size_bytes) VALUES (?::uuid,?::uuid,?::uuid,'review-test.png','image/png',100)",
            attachment,id,identity);
        long postings=jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid",Long.class,id);
        long plotRevision=jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Long.class,plot);
        String number=jdbc.queryForObject("SELECT data->>'plotNumber' FROM sos.erp_records WHERE id=?::uuid",String.class,plot);
        ObjectNode geometry=(ObjectNode)json.readTree("""
            {"plots":[{"number":"placeholder","facing":"UNKNOWN","points":[{"x":10,"y":10},{"x":40,"y":10},{"x":40,"y":40}]}],
             "roads":[{"name":"Road","widthFeet":20,"points":[{"x":0,"y":45},{"x":100,"y":45},{"x":100,"y":50}]}],"northDegrees":null,"notes":"Fixture draft"}
            """);
        ((ObjectNode)geometry.path("plots").get(0)).put("number",number);
        String path="/erp/"+id+"/blueprint";
        assertEquals(0,request("GET",path,null,accountant,200).path("revision").asInt());
        JsonNode saved=request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",0,"geometry",geometry,"confirm",false),accountant,200);
        assertEquals("DRAFT",saved.path("status").asText());
        request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",1,"geometry",geometry,"confirm",true),accountant,400);
        request("POST",path+"/save",Map.of("attachmentId",java.util.UUID.randomUUID().toString(),"revision",1,"geometry",geometry,"confirm",false),accountant,403);
        JsonNode confirmed=request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",1,"geometry",geometry,"confirm",true,"reviewAcknowledged",true),accountant,200);
        assertEquals("CONFIRMED",confirmed.path("status").asText());
        ObjectNode revised=geometry.deepCopy();revised.put("notes","New draft, not yet confirmed");
        JsonNode draft=request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",2,"geometry",revised,"confirm",false),accountant,200);
        assertEquals("Fixture draft",draft.path("confirmed").path("notes").asText());
        request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",2,"geometry",revised,"confirm",false),accountant,409);
        boolean existing=jdbc.queryForObject("SELECT count(*) FROM sos.project_memberships WHERE project_id=?::uuid AND identity_id=?::uuid",Integer.class,id,identity)>0;
        if(!existing) jdbc.update("INSERT INTO sos.project_memberships(project_id,identity_id) VALUES (?::uuid,?::uuid)",id,identity);
        try {
            JsonNode visible=request("GET",path,null,partner,200);
            assertFalse(visible.path("canManage").asBoolean());
            assertTrue(visible.path("draft").isNull()||visible.path("draft").isMissingNode());assertEquals("Fixture draft",visible.path("confirmed").path("notes").asText());
            request("POST",path+"/save",Map.of("attachmentId",attachment,"revision",3,"geometry",revised,"confirm",false),partner,403);
            request("GET",path,null,outsider,403);
        } finally { if(!existing) jdbc.update("DELETE FROM sos.project_memberships WHERE project_id=?::uuid AND identity_id=?::uuid",id,identity); }
        assertEquals(postings,jdbc.queryForObject("SELECT count(*) FROM sos.erp_postings WHERE project_id=?::uuid",Long.class,id));
        assertEquals(plotRevision,jdbc.queryForObject("SELECT revision FROM sos.erp_records WHERE id=?::uuid",Long.class,plot));
    }
}
