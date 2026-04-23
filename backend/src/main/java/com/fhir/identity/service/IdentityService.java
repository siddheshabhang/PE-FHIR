package com.fhir.identity.service;

import com.fhir.identity.dto.RegisterPatientDTO;
import com.fhir.identity.model.GlobalPatientIdentity;
import com.fhir.identity.repository.GlobalPatientIdentityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

@Service
public class IdentityService {

    @Autowired
    private GlobalPatientIdentityRepository repo;

    public GlobalPatientIdentity register(RegisterPatientDTO dto) {
        GlobalPatientIdentity gpi = new GlobalPatientIdentity();
        gpi.setGlobalId(UUID.randomUUID().toString());
        gpi.setHospitalAId(dto.getHospitalAId());
        gpi.setHospitalBId(dto.getHospitalBId());
        gpi.setName(dto.getName());
        return repo.save(gpi);
    }

    public String resolveGlobalId(String hospitalAId) {
        return repo.findByHospitalAId(hospitalAId)
            .map(GlobalPatientIdentity::getGlobalId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Patient not registered in identity service: " + hospitalAId));
    }

    public boolean exists(String hospitalAId) {
        return repo.findByHospitalAId(hospitalAId).isPresent();
    }
}
