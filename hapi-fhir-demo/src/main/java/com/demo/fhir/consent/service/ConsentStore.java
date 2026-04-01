package com.demo.fhir.consent.service;

import com.demo.fhir.consent.model.ConsentAction;
import com.demo.fhir.consent.model.ConsentAuditLog;
import com.demo.fhir.consent.model.ConsentPreference;
import com.demo.fhir.consent.model.ConsentStatus;
import com.demo.fhir.consent.repository.ConsentAuditLogRepository;
import com.demo.fhir.consent.repository.ConsentPreferenceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ConsentStore {

    @Autowired
    private ConsentPreferenceRepository preferenceRepository;

    @Autowired
    private ConsentAuditLogRepository auditLogRepository;

    // ── Public API (unchanged — callers require no modification) ─────────────

    @Transactional
    public void store(String patientId, ConsentStatus status) {
        ConsentPreference pref = preferenceRepository.findByPatientId(patientId)
                .orElseGet(() -> {
                    ConsentPreference newPref = new ConsentPreference();
                    newPref.setPatientId(patientId);
                    return newPref;
                });

        boolean isNew = (pref.getId() == null);
        pref.setConsentStatus(status);
        preferenceRepository.save(pref);

        // Append audit entry — GRANTED on first store, MODIFIED on subsequent
        ConsentAction action = isNew ? ConsentAction.GRANTED : ConsentAction.MODIFIED;
        appendAudit(patientId, action, buildSnapshot(pref));
    }

    @Transactional(readOnly = true)
    public boolean hasConsent(String patientId) {
        return preferenceRepository.findByPatientId(patientId)
                .map(p -> ConsentStatus.GRANTED.equals(p.getConsentStatus()))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public ConsentStatus getStatus(String patientId) {
        return preferenceRepository.findByPatientId(patientId)
                .map(ConsentPreference::getConsentStatus)
                .orElse(null);
    }

    @Transactional
    public void revoke(String patientId) {
        ConsentPreference pref = preferenceRepository.findByPatientId(patientId)
                .orElseGet(() -> {
                    ConsentPreference newPref = new ConsentPreference();
                    newPref.setPatientId(patientId);
                    return newPref;
                });
        pref.setConsentStatus(ConsentStatus.DENIED);
        preferenceRepository.save(pref);
        appendAudit(patientId, ConsentAction.REVOKED, buildSnapshot(pref));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void appendAudit(String patientId, ConsentAction action, String snapshot) {
        ConsentAuditLog log = new ConsentAuditLog();
        log.setPatientId(patientId);
        log.setAction(action);
        log.setChangedBy("system");   // TODO Phase 3: replace with authenticated user
        log.setPreferencesSnapshot(snapshot);
        auditLogRepository.save(log);
    }

    private String buildSnapshot(ConsentPreference pref) {
        return String.format(
                "{\"status\":\"%s\",\"shareWithHospitalB\":%b,\"shareDiagnostics\":%b," +
                "\"shareMedications\":%b,\"shareLabResults\":%b," +
                "\"shareSurgicalHistory\":%b,\"shareAllergies\":%b}",
                pref.getConsentStatus(),
                pref.isShareWithHospitalB(),
                pref.isShareDiagnostics(),
                pref.isShareMedications(),
                pref.isShareLabResults(),
                pref.isShareSurgicalHistory(),
                pref.isShareAllergies()
        );
    }
}