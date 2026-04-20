package com.fhir.shared.audit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    @Autowired
    private TransferAuditLogRepository repository;

    /** Insert a PENDING transfer row. Returns the id for later update. */
    @Transactional
    public Long logPending(String patientId,
                           String sourceHospital,
                           String targetHospital,
                           int bundleResourceCount,
                           String consentSnapshot) {
        TransferAuditLog log = new TransferAuditLog();
        log.setPatientId(patientId);
        log.setSourceHospital(sourceHospital);
        log.setTargetHospital(targetHospital);
        log.setBundleResourceCount(bundleResourceCount);
        log.setConsentSnapshot(consentSnapshot);
        log.setStatus(TransferStatus.PENDING);
        return repository.save(log).getId();
    }

    @Transactional
    public void markSuccess(Long id) {
        repository.findById(id).ifPresent(log -> {
            log.setStatus(TransferStatus.SUCCESS);
            repository.save(log);
        });
    }

    @Transactional
    public void markFailed(Long id, String reason) {
        repository.findById(id).ifPresent(log -> {
            log.setStatus(TransferStatus.FAILED);
            log.setFailureReason(reason);
            repository.save(log);
        });
    }
}
