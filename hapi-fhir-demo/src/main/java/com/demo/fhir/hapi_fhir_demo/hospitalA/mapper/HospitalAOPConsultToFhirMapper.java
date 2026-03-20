package com.demo.fhir.hapi_fhir_demo.hospitalA.mapper;

import com.demo.fhir.hapi_fhir_demo.hospitalA.Dto.HospitalAOPConsultRecordDTO;
import org.hl7.fhir.r4.model.*;

import java.util.Base64;
import java.util.Date;

public class HospitalAOPConsultToFhirMapper {
    public static Bundle mapToBundle(HospitalAOPConsultRecordDTO dto) {
        // ── Patient ──────────────────────────────────────────────────────────
        Patient patient = new Patient();
        patient.setId(dto.getPatientId());
        HumanName name = new HumanName();
        name.setFamily(dto.getPatientLastName());
        name.addGiven(dto.getPatientFirstName());
        patient.addName(name);

        // ── Practitioner ─────────────────────────────────────────────────────
        Practitioner practitioner = new Practitioner();
        practitioner.setId("PR-" + dto.getDoctorName().replace(" ", ""));
        HumanName docName = new HumanName();
        docName.setText(dto.getDoctorName());
        practitioner.addName(docName);

        // ── Encounter ────────────────────────────────────────────────────────
        Encounter encounter = new Encounter();
        encounter.setStatus(Encounter.EncounterStatus.FINISHED);
        encounter.setClass_(
                new Coding()
                        .setSystem("http://terminology.hl7.org/CodeSystem/v3-ActCode")
                        .setCode("AMB")
                        .setDisplay("Ambulatory")
        );
        encounter.setSubject(new Reference("Patient/" + dto.getPatientId()));
        encounter.setPeriod(new Period().setStart(new Date()));
        encounter.addParticipant()
                .setIndividual(new Reference("Practitioner/" + practitioner.getId()));

        // ── Observation: Temperature ─────────────────────────────────────────
        Observation temperatureObs = new Observation();
        temperatureObs.setStatus(Observation.ObservationStatus.FINAL);
        temperatureObs.setCode(new CodeableConcept().addCoding(
                new Coding()
                        .setSystem("http://loinc.org")
                        .setCode("8310-5")
                        .setDisplay("Body temperature")
        ));
        temperatureObs.setValue(
                new Quantity().setValue(dto.getTemperature()).setUnit("F")
        );
        temperatureObs.setSubject(new Reference("Patient/" + dto.getPatientId()));

        // ── Observation: Blood Pressure ──────────────────────────────────────
        Observation bpObs = new Observation();
        bpObs.setStatus(Observation.ObservationStatus.FINAL);
        bpObs.setCode(new CodeableConcept().addCoding(
                new Coding()
                        .setSystem("http://loinc.org")
                        .setCode("85354-9")
                        .setDisplay("Blood pressure panel")
        ));
        bpObs.setValue(new StringType(dto.getBloodPressure()));
        bpObs.setSubject(new Reference("Patient/" + dto.getPatientId()));

        // ── Observation: Symptoms ────────────────────────────────────────────
        Observation symptomsObs = new Observation();
        symptomsObs.setStatus(Observation.ObservationStatus.FINAL);
        symptomsObs.setCode(new CodeableConcept().addCoding(
                new Coding()
                        .setSystem("http://loinc.org")
                        .setCode("75325-1")
                        .setDisplay("Symptoms")
        ));
        symptomsObs.setValue(new StringType(dto.getSymptoms()));
        symptomsObs.setSubject(new Reference("Patient/" + dto.getPatientId()));

        // ── DocumentReference ─────────────────────────────────────────────────
        // This is the core FHIR technique for sending a prescription PDF.
        // The PDF (Base64 string from DTO) is decoded to byte[] and embedded
        // inside the FHIR Attachment. No file storage or URL is needed —
        // the document travels self-contained inside the Bundle.

        DocumentReference docRef = new DocumentReference();
        docRef.setStatus(Enumerations.DocumentReferenceStatus.CURRENT);
        CodeableConcept type = new CodeableConcept();
        type.addCoding()
                .setSystem("http://loinc.org")
                .setCode("60591-5")
                .setDisplay("Prescription Document");
        docRef.setType(type);

        // Link this document to the correct patient
        docRef.setSubject(new Reference("Patient/" + dto.getPatientId()));

        // Attachment: contentType tells the receiver this is a PDF
        // setData() takes byte[] — we decode the Base64 string back to bytes
        // This is the reverse of: Base64.getEncoder().encodeToString(pdfBytes)
        Attachment attachment = new Attachment();
        attachment.setContentType("application/pdf");
        attachment.setData(
                Base64.getDecoder().decode(dto.getPrescriptionPdfBase64())
        );

        // Attach the PDF to the DocumentReference content
        docRef.addContent().setAttachment(attachment);

        // ── Bundle: assemble all resources ────────────────────────────────────
        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.COLLECTION);
        bundle.addEntry().setResource(patient);
        bundle.addEntry().setResource(practitioner);
        bundle.addEntry().setResource(encounter);
        bundle.addEntry().setResource(temperatureObs);
        bundle.addEntry().setResource(bpObs);
        bundle.addEntry().setResource(symptomsObs);
        bundle.addEntry().setResource(docRef);
        return bundle;
    }
}