package com.demo.fhir.auth.service;

import com.demo.fhir.auth.dto.LoginRequest;
import com.demo.fhir.auth.dto.LoginResponse;
import com.demo.fhir.auth.dto.RegisterRequest;
import com.demo.fhir.auth.model.AppUser;
import com.demo.fhir.auth.repository.AuthUserRepository;
import com.demo.fhir.shared.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private AuthUserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Value("${jwt.access-token-expiry-seconds}")
    private long accessTokenExpiry;

    @Value("${jwt.refresh-token-expiry-seconds}")
    private long refreshTokenExpiry;

    // ── Register ──────────────────────────────────────────────────────────────

    @Transactional
    public AppUser register(RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new IllegalArgumentException(
                    "Username already taken: " + request.getUsername());
        }

        AppUser user = new AppUser();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());
        user.setPatientId(request.getPatientId());

        return userRepository.save(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Transactional
    public LoginResponse login(LoginRequest request) {
        AppUser user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() ->
                        new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        String accessToken  = buildAccessToken(user);
        String refreshToken = buildAndStoreRefreshToken(user);

        return new LoginResponse(accessToken, refreshToken,
                                 user.getUsername(), user.getRole());
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    @Transactional
    public String refresh(String rawRefreshToken) {
        // Parse to get username — throws JwtException if expired/invalid
        var claims  = jwtUtil.parse(rawRefreshToken);
        String type = claims.get("type", String.class);
        if (!"refresh".equals(type)) {
            throw new IllegalArgumentException("Not a refresh token");
        }

        String username = claims.getSubject();
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Verify the hashed token matches what we stored
        if (user.getRefreshTokenHash() == null
                || !passwordEncoder.matches(rawRefreshToken, user.getRefreshTokenHash())) {
            throw new IllegalArgumentException("Refresh token has been invalidated");
        }

        return buildAccessToken(user);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildAccessToken(AppUser user) {
        Map<String, Object> claims = Map.of(
                "sub",       user.getUsername(),
                "role",      user.getRole().name(),
                "patientId", user.getPatientId() != null ? user.getPatientId() : "",
                "type",      "access"
        );
        return jwtUtil.sign(claims, accessTokenExpiry);
    }

    private String buildAndStoreRefreshToken(AppUser user) {
        String jti = UUID.randomUUID().toString();
        Map<String, Object> claims = Map.of(
                "sub",  user.getUsername(),
                "role", user.getRole().name(),
                "jti",  jti,
                "type", "refresh"
        );
        String rawToken = jwtUtil.sign(claims, refreshTokenExpiry);
        // Store the hash — never store the raw token in the DB
        user.setRefreshTokenHash(passwordEncoder.encode(rawToken));
        userRepository.save(user);
        return rawToken;
    }
}
