package com.syndicateos.workspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syndicateos.auth.SessionAccount;
import com.syndicateos.configuration.ConfigurationService;
import com.syndicateos.core.ApiProblem;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class FirmCodeUpdateTest {
    final ObjectMapper json=new ObjectMapper();
    final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    final ConfigurationService config=mock(ConfigurationService.class);
    final TransactionTemplate tx=mock(TransactionTemplate.class);
    final UUID firm=UUID.randomUUID();
    final SessionAccount owner=new SessionAccount(UUID.randomUUID(),"OWNER","Fixture owner","",false,null,null);
    CommandService service;

    @BeforeEach void setup() {
        when(tx.execute(any())).thenAnswer(call -> {
            TransactionCallback<?> callback=call.getArgument(0);
            return callback.doInTransaction(null);
        });
        when(config.parse("{}")).thenAnswer(call -> json.createObjectNode());
        when(jdbc.update(anyString(),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(anyString(),eq(Integer.class),any(),any())).thenReturn(0);
        when(jdbc.queryForObject(anyString(),eq(String.class),eq(firm))).thenReturn("SHA");
        service=new CommandService(jdbc,tx,config,null,null,null,null,null,null);
    }

    com.fasterxml.jackson.databind.node.ObjectNode input(String code) {
        var value=json.createObjectNode().put("firmId",firm.toString()).put("name","Fixture firm")
            .put("status","ACTIVE").put("revision",3);
        if (code!=null) value.put("clientCode",code);
        return value;
    }

    @Test void persistsNormalizedCodeWithRevisionAndReturnsPersistedCode() {
        var result=service.execute(owner,"firm.update",input(" sha "));
        verify(jdbc).update(startsWith("UPDATE sos.firms SET client_code=COALESCE"),
            eq("SHA"),eq("Fixture firm"),eq("ACTIVE"),eq("{}"),eq(firm),eq(3));
        assertEquals("SHA",((java.util.Map<?,?>)result.get("entity")).get("clientCode"));
    }

    @Test void statusOnlyUpdatePreservesCode() {
        service.execute(owner,"firm.update",input(null));
        verify(jdbc).update(startsWith("UPDATE sos.firms SET client_code=COALESCE"),
            isNull(),eq("Fixture firm"),eq("ACTIVE"),eq("{}"),eq(firm),eq(3));
    }

    @Test void duplicatesAreRejectedWithoutWriting() {
        when(jdbc.queryForObject(anyString(),eq(Integer.class),any(),any())).thenReturn(1);
        var error=assertThrows(ApiProblem.class,()->service.execute(owner,"firm.update",input("SHA")));
        assertEquals("FIRM_CODE_IN_USE",error.code);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test void staleRevisionDoesNotReportSuccess() {
        when(jdbc.update(anyString(),any(Object[].class))).thenReturn(0);
        var error=assertThrows(ApiProblem.class,()->service.execute(owner,"firm.update",input("SHA")));
        assertEquals("REVISION_CONFLICT",error.code);
        verify(config,never()).audit(any(),anyString(),any(),any());
    }

    @Test void invalidCodesAndNonOwnersAreRejected() {
        assertEquals(400,assertThrows(ApiProblem.class,
            ()->service.execute(owner,"firm.update",input("S HA"))).status);
        var partner=new SessionAccount(UUID.randomUUID(),"PARTNER","Fixture partner","",false,firm,"OLD");
        assertEquals(403,assertThrows(ApiProblem.class,
            ()->service.execute(partner,"firm.update",input("SHA"))).status);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }
}
