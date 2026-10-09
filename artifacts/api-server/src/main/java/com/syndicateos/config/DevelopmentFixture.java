package com.syndicateos.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.erp.ErpService;
import com.syndicateos.workspace.CommandService;
import java.util.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;

/** Explicit, disposable preview only. Never uses the customer's RDS or a production database. */
@Component
@Order(1)
@ConditionalOnProperty(name="sos.preview-fixture",havingValue="true")
public class DevelopmentFixture implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final CommandService commands;
    private final ErpService erp;
    private final ObjectMapper json;
    private final PasswordEncoder encoder;
    public DevelopmentFixture(JdbcTemplate jdbc,CommandService commands,ErpService erp,ObjectMapper json,PasswordEncoder encoder) {
        this.jdbc=jdbc;this.commands=commands;this.erp=erp;this.json=json;this.encoder=encoder;
    }
    @Override public void run(ApplicationArguments args) throws Exception {
        try(var connection=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if(!connection.getMetaData().getURL().startsWith("jdbc:postgresql://127.0.0.1:")
                || !"sos_preview".equals(connection.getCatalog()))
                throw new IllegalStateException("Development fixtures require a disposable localhost sos_preview database.");
        }
        if(jdbc.queryForObject("SELECT count(*) FROM sos.firms WHERE client_code='SOS-DEMO'",Integer.class)>0) return;
        UUID owner=jdbc.queryForObject("SELECT identity_id FROM sos.owner_memberships LIMIT 1",UUID.class);
        SessionAccount ownerActor=new SessionAccount(owner,"OWNER","Preview owner","",false,null,null);
        List<Map<String,Object>> assignments=new ArrayList<>();
        List<Map<String,Object>> sectors=jdbc.queryForList("""
            SELECT s.id,s.code,s.name,r.id AS release FROM sos.sectors s
            JOIN LATERAL (SELECT id FROM sos.sector_releases WHERE sector_id=s.id AND state='PUBLISHED' ORDER BY version DESC LIMIT 1) r ON true
            ORDER BY s.code DESC
            """);
        for(var s:sectors) assignments.add(Map.of("sectorId",s.get("id").toString(),"releaseId",s.get("release").toString()));
        var firm=commands.execute(ownerActor,"firm.create",json.valueToTree(Map.of("name","Development Demo · Not Live Data","clientCode","SOS-DEMO",
            "accountantName","Demo Accountant","accountantMobile","9000000001","assignments",assignments)));
        UUID firmId=UUID.fromString(((Map<?,?>)firm.get("entity")).get("id").toString());
        UUID accountantId=jdbc.queryForObject("SELECT id FROM sos.identities WHERE mobile='+919000000001'",UUID.class);
        SessionAccount accountant=new SessionAccount(accountantId,"ACCOUNTANT","Demo Accountant","+919000000001",false,firmId,"SOS-DEMO");
        for(var s:sectors) {
            Map<String,Object> details=new HashMap<>();
            if("open-plotting".equals(s.get("code"))) { details.put("plotCount",0);details.put("extentValue",1);details.put("extentUnit","Acres");details.put("roadWidth",0);details.put("openSpacePercent",0); }
            if("construction".equals(s.get("code"))) details.put("unitCount",0);
            var project=commands.execute(accountant,"project.create",json.valueToTree(Map.of("sectorId",s.get("id").toString(),
                "name","Demo "+s.get("name")+" venture","location","Demo site","details",details)));
            UUID id=UUID.fromString(((Map<?,?>)project.get("entity")).get("id").toString());
            List<UUID> partners=new ArrayList<>();
            for(int n=2;n<=3;n++) {
                String mobile="900000000"+n;
                var partner=commands.execute(accountant,"partner.add",json.valueToTree(Map.of("projectId",id.toString(),"name","Demo Partner "+(n-1),"mobile",mobile)));
                UUID partnerId=UUID.fromString(((Map<?,?>)partner.get("entity")).get("identityId").toString());
                partners.add(partnerId);
                save(accountant,id,"partner-profiles",Map.of("partnerId",partnerId.toString(),"fixedEquityPercent",50,"initialCapital",10000,
                    "userRole",n==2?"managing_partner":"field_partner"));
            }
            UUID account=save(accountant,id,"accounts",Map.of("accountName","Project Treasury","accountType","current_operational","openingBalance",0,"status","active"));
            for(UUID p:partners) {
                UUID investment=save(accountant,id,"investments",Map.of("partnerId",p.toString(),"amount","10000.00","accountId",account.toString(),
                    "date","2026-10-09","purpose","Demo capital","paymentMode","UPI"));
                erp.execute(accountant,"erp.review",json.valueToTree(Map.of("projectId",id.toString(),"recordId",investment.toString(),"revision",1,"decision","approved")));
            }
            if("open-plotting".equals(s.get("code"))) for(int n=1;n<=3;n++)
                save(accountant,id,"plots",Map.of("plotNumber",String.valueOf(n),"areaSqYards",200,"ratePerSqYard",10000,"facing",n==1?"East":"North","status","available","dimensions","40 x 45","roadWidthFt",0));
            if("construction".equals(s.get("code"))) for(int n=101;n<=103;n++)
                save(accountant,id,"units",Map.of("unitNumber",String.valueOf(n),"floor",1,"flatType","2 BHK","sftArea",1000,"baseRate",5000,"facing","East","status","available"));
        }
        jdbc.update("UPDATE sos.identities SET credential_hash=?,must_change_credential=false,temporary_credential_expires_at=NULL,credential_version=credential_version+1 WHERE mobile IN ('+919000000001','+919000000002','+919000000003')",encoder.encode("246810"));
    }
    private UUID save(SessionAccount actor,UUID project,String kind,Map<String,Object> data) {
        var result=erp.execute(actor,"erp.save",json.valueToTree(Map.of("projectId",project.toString(),"kind",kind,"data",data,"requestId",UUID.randomUUID().toString())));
        return UUID.fromString(((Map<?,?>)result.get("entity")).get("id").toString());
    }
}
