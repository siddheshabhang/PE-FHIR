package com.demo.fhir.consent.service;

import com.demo.fhir.consent.dto.ConsentDecisionDTO;
import com.demo.fhir.consent.dto.ConsentRequestViewDTO;
import com.demo.fhir.consent.dto.InitiateConsentDTO;
import com.demo.fhir.consent.model.ConsentAction;
import com.demo.fhir.consent.model.ConsentAuditLog;
import com.demo.fhir.consent.model.ConsentRequestEntity;
import com.demo.fhir.consent.model.ConsentStatus;
import com.demo.fhir.consent.repository.ConsentAuditLogRepository;
import com.demo.fhir.consent.repository.ConsentRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConsentStore {

    @Autowired
    private ConsentRequestRepository requestRepository;

    @Autowired
    private ConsentAuditLogRepository auditLogRepository;

    // ── Public API ───────────────────────────────────────────────────────────

    @Transactional
    public ConsentRequestViewDTO initiateRequest(InitiateConsentDTO dto, String requesterId) {
        ConsentRequestEntity request = new ConsentRequestEntity();
        request.setPatientId(dto.getPatientId());
        request.setRequesterId(requesterId);
        request.setPurpose(dto.getPurpose());
        request.setStatus(ConsentStatus.PENDING);

        ConsentRequestEntity saved = requestRepository.save(request);
        appendAudit(saved, ConsentAction.INITIATED);
        return mapToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<ConsentRequestViewDTO> getPendingRequests(String patientId) {
        return requestRepository.findByPatientIdAndStatus(patientId, ConsentStatus.PENDING)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ConsentRequestViewDTO processDecision(Long requestId, String patientId, ConsentDecisionDTO dto) {
        ConsentRequestEntity request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!request.getPatientId().equals(patientId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to respond to this request");
        }

        if (request.getStatus() != ConsentStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is already processed");
        }

        request.setStatus(dto.getDecision());
        ConsentRequestEntity saved = requestRepository.save(request);

        ConsentAction action = dto.getDecision() == ConsentStatus.GRANTED ? ConsentAction.GRANTED : ConsentAction.DENIED;
        appendAudit(saved, action);

        return mapToDTO(saved);
    }

    @Transactional
    public void revoke(Long requestId, String patientId) {
        ConsentRequestEntity request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
                
        if (!request.getPatientId().equals(patientId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to revoke this request");
        }

        request.setStatus(ConsentStatus.REVOKED);
        ConsentRequestEntity saved = requestRepository.save(request);
        appendAudit(saved, ConsentAction.REVOKED);
    }

    @Transactional(readOnly = true)
    public boolean hasActiveConsent(String patientId, String requesterId) {
        List<ConsentRequestEntity> grantedReqs = requestRepository.findByPatientIdAndRequesterIdAndStatus(patientId, requesterId, ConsentStatus.GRANTED);
        return !grantedReqs.isEmpty();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void appendAudit(ConsentRequestEntity request, ConsentAction action) {
        ConsentAuditLog log = new ConsentAuditLog();
        log.setPatientId(request.getPatientId());
        log.setAction(action);
        log.setChangedBy(getCurrentUsername());
        log.setPreferencesSnapshot(buildRequestSnapshot(request));
        auditLogRepository.save(log);
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            return auth.getName();
        }
        return "system"; // fallback
    }

    private String buildRequestSnapshot(ConsentRequestEntity req) {
        return String.format(
                "{\"requestId\":%d,\"requesterId\":\"%s\",\"purpose\":\"%s\",\"status\":\"%s\"}",
                req.getId(),
                req.getRequesterId(),
                req.getPurpose(),
                req.getStatus()
        );
    }

    private ConsentRequestViewDTO mapToDTO(ConsentRequestEntity entity) {
        ConsentRequestViewDTO dto = new ConsentRequestViewDTO();
        dto.setId(entity.getId());
        dto.setPatientId(entity.getPatientId());
        dto.setRequesterId(entity.getRequesterId());
        dto.setPurpose(entity.getPurpose());
        dto.setStatus(entity.getStatus());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}