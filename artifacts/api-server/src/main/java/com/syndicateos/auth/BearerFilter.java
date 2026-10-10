package com.syndicateos.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syndicateos.core.ApiProblem;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.filter.OncePerRequestFilter;

public class BearerFilter extends OncePerRequestFilter {
    private final AuthService auth;
    private final ObjectMapper mapper;
    public BearerFilter(AuthService auth, ObjectMapper mapper) { this.auth=auth; this.mapper=mapper; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
            && !request.getRequestURI().startsWith("/api/marketing/access/")
            && !List.of("/api/auth/login","/api/auth/company","/api/healthz","/api/readyz").contains(request.getRequestURI())) {
            try {
                SessionAccount account = auth.authenticate(header.substring(7));
                SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(account, header.substring(7), List.of(new SimpleGrantedAuthority("ROLE_"+account.role()))));
            } catch (ApiProblem error) {
                response.setStatus(error.status); response.setContentType("application/json");
                mapper.writeValue(response.getOutputStream(), Map.of("error",error.code,"message",error.getMessage())); return;
            } catch (org.springframework.dao.DataAccessException error) {
                response.setStatus(503); response.setContentType("application/json");
                mapper.writeValue(response.getOutputStream(), Map.of("error","DATABASE_UNAVAILABLE","message","The SOS database is unavailable.")); return;
            }
        }
        chain.doFilter(request,response);
    }
}
