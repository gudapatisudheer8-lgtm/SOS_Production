package com.syndicateos.config;

import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Exit only after the guarded setup runner has completed successfully. */
@Component
@Order(2)
@ConditionalOnProperty(name="sos.setup-exit",havingValue="true")
public class SetupExit implements ApplicationRunner {
    private final ConfigurableApplicationContext context;
    public SetupExit(ConfigurableApplicationContext context) { this.context=context; }
    @Override public void run(ApplicationArguments args) {
        if(!context.getEnvironment().getProperty("sos.setup-approved",Boolean.class,false))
            throw new IllegalStateException("Setup exit requires explicit setup approval.");
        System.exit(SpringApplication.exit(context,()->0));
    }
}
