package com.syndicateos.core;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiProblems {
    @ExceptionHandler(ApiProblem.class)
    ResponseEntity<?> problem(ApiProblem error) {
        return ResponseEntity.status(error.status).body(Map.of("error", error.code, "message", error.getMessage()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> integrity() {
        return ResponseEntity.status(409).body(Map.of("error", "DATA_CONFLICT",
            "message", "A duplicate or incompatible record prevents this change. Reload and check the input."));
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database() {
        return ResponseEntity.status(503).body(Map.of("error", "DATABASE_UNAVAILABLE",
            "message", "The SOS database is unavailable or setup is incomplete. No successful save is being claimed."));
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class, MethodArgumentNotValidException.class})
    ResponseEntity<?> invalid() {
        return ResponseEntity.badRequest().body(Map.of("error", "VALIDATION_FAILED",
            "message", "Check the supplied values and required fields."));
    }
}
