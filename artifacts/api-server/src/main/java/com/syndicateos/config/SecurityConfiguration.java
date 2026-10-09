package com.syndicateos.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.syndicateos.auth.AuthService;
import com.syndicateos.auth.BearerFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;
import java.util.Arrays;
import org.springframework.core.env.Environment;

/**
 * Fail closed during foundation setup. Business routes will be enabled only
 * alongside their authentication and membership checks, never as public stubs.
 */
@Configuration
public class SecurityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AuthService authService, ObjectMapper mapper,
        @Value("${sos.allowed-origins:}") String origins, Environment environment) throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        var allowed = new java.util.ArrayList<>(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
        // Exact workspace-managed hosts only; never reflect an arbitrary Origin or use '*'.
        for (String key : java.util.List.of("REPLIT_EXPO_DEV_DOMAIN","REPLIT_DEV_DOMAIN")) {
            String host=environment.getProperty(key);
            if (host!=null && host.matches("[a-zA-Z0-9.-]+")) allowed.add("https://"+host);
        }
        cors.setAllowedOrigins(allowed);
        cors.setAllowedMethods(java.util.List.of("GET", "POST", "OPTIONS"));
        cors.setAllowedHeaders(java.util.List.of("Content-Type", "Authorization"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        return http
            .cors(config -> config.configurationSource(source))
            .addFilterBefore(new BearerFilter(authService, mapper), UsernamePasswordAuthenticationFilter.class)
            .csrf(csrf -> csrf.disable()) // Stateless bearer authentication; no cookie sessions.
            .formLogin(login -> login.disable())
            .httpBasic(basic -> basic.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/healthz", "/api/readyz", "/api/auth/login", "/api/auth/company").permitAll()
                .requestMatchers("/api/auth/**", "/api/workspace", "/api/commands/**", "/api/configuration/**").authenticated()
                .anyRequest().denyAll())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"AUTHENTICATION_REQUIRED\"}");
                })
                .accessDeniedHandler((request, response, exception) -> {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"ACCESS_DENIED\"}");
                }))
            .build();
    }
}
