package com.fhir.hospitalB.dto;

import lombok.Data;

@Data
public class HospitalBOPConsultRecordDTO {
    private String uhid;
    private String patientName;
    private String consultDate;
    private String doctor;
    private String clinicalNotes;
    private Vitals vitals;

    private String prescriptionPdfBase64;
    private boolean consentVerified;

    @Data
    public static class Vitals {
        private String bp;
        private String temp;
    }
}