package com.demo.fhir.hapi_fhir_demo.hospitalA.mapper;

import com.demo.fhir.hapi_fhir_demo.hospitalA.Dto.HospitalAOPConsultRecordDTO;
import org.hl7.fhir.r4.model.*;

import java.util.Date;

public class HospitalAOPConsultToFhirMapper {
    public static Bundle mapToBundle(HospitalAOPConsultRecordDTO dto) {
        Patient patient = new Patient();
        patient.setId(dto.getPatientId());

        Encounter encounter = new Encounter();
//        encounter.setStatus(Encounter.EncounterStatus.FINISHED);
        encounter.setClass_(
                new Coding()
                        .setSystem("http://terminology.hl7.org/CodeSystem/v3-ActCode")
                        .setCode("AMB")
                        .setDisplay("Ambulatory")
        );
        encounter.setSubject(new Reference("Patient/" + dto.getPatientId()));
        encounter.setPeriod(
                new Period().setStart(new Date())
        );

        Observation temperatureObs = new Observation();
        temperatureObs.setStatus(Observation.ObservationStatus.FINAL);
        temperatureObs.setCode(
                new CodeableConcept().addCoding(
                        new Coding()
                                .setSystem("http://loinc.org")
                                .setCode("8310-5")
                                .setDisplay("Body temperature")
                )
        );
        temperatureObs.setValue(
                new Quantity()
                        .setValue(dto.getTemperature())
                        .setUnit("F")
        );
        temperatureObs.setSubject(new Reference("Patient/" + dto.getPatientId()));

        Observation bpObs = new Observation();
        bpObs.setStatus(Observation.ObservationStatus.FINAL);
        bpObs.setCode(
                new CodeableConcept().addCoding(
                        new Coding()
                                .setSystem("http://loinc.org")
                                .setCode("85354-9")
                                .setDisplay("Blood pressure panel")
                )
        );
        bpObs.setValue(
                new StringType(dto.getBloodPressure())
        );
        bpObs.setSubject(new Reference("Patient/" + dto.getPatientId()));

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.COLLECTION);

        bundle.addEntry().setResource(patient);
        bundle.addEntry().setResource(encounter);
        bundle.addEntry().setResource(temperatureObs);
        bundle.addEntry().setResource(bpObs);
        return bundle;
    }
}
