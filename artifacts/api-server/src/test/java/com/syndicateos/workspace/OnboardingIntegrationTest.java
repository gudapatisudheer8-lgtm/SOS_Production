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
    "spring.flyway.enabled=false"
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
    @Test void migrationsAndCompleteTenantIsolatedOnboarding() {
        String owner=login("OWNER","9888880000","Owner-integration-123","",200).path("token").asText();
        request("GET","/workspace",null,owner,403);
        owner=change(owner,"Owner-integration-123","Owner-updated-123");
        request("POST","/auth/credential",Map.of("currentCredential","Owner-updated-123","newCredential","123456"),owner,400);
        request("POST","/auth/company",Map.of("clientCode","MISSING"),null,404);
        request("POST","/auth/company",Map.of("clientCode",""),null,400);
        JsonNode workspace=request("GET","/workspace",null,owner,200);
        assertEquals(2,workspace.path("sectors").size());
        JsonNode sector=workspace.path("sectors").get(0), other=workspace.path("sectors").get(1);
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
        command("firm.update",Map.of("firmId",firmA,"name","Test firm A","status","SUSPENDED","revision",1),owner,200);
        request("POST","/auth/company",Map.of("clientCode","TEST-A"),null,404);
        request("GET","/workspace",null,accountant,401);
        request("GET","/workspace",null,partner,401);
        assertEquals(1,request("GET","/workspace",null,partnerB,200).path("projects").size());
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM sos.projects",Integer.class));
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
}
