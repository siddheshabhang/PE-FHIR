package com.demo.fhir.hapi_fhir_demo.hospitalB.Dto;

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

    @Data
    public static class Vitals {
        private String bp;
        private String temp;
    }
}
