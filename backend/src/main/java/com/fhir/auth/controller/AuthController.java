package com.fhir.auth.controller;

import com.fhir.auth.dto.LoginRequest;
import com.fhir.auth.dto.LoginResponse;
import com.fhir.auth.dto.RefreshRequest;
import com.fhir.auth.dto.RegisterRequest;
import com.fhir.auth.model.AppUser;
import com.fhir.auth.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    // ── POST /auth/register ───────────────────────────────────────────────────
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> register(@RequestBody RegisterRequest request) {
        AppUser saved = authService.register(request);
        return Map.of(
                "message", "User registered successfully",
                "username", saved.getUsername(),
                "role", saved.getRole().name()
        );
    }

    // ── POST /auth/login ──────────────────────────────────────────────────────
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // ── POST /auth/refresh ────────────────────────────────────────────────────
    @PostMapping("/refresh")
    public Map<String, String> refresh(@RequestBody RefreshRequest request) {
        String newAccessToken = authService.refresh(request.getRefreshToken());
        return Map.of("accessToken", newAccessToken);
    }
}
