package com.demo.fhir.hapi_fhir_demo.hospitalA.Dto;

import lombok.Data;

@Data
public class HospitalAOPConsultRecordDTO {
    private String patientId;
    private String patientFirstName;
    private String patientLastName;
    private String doctorName;
    private String visitDate;        // Hospital-A specific format
    private String symptoms;
    private double temperature;
    private String bloodPressure;
    private String prescriptionPdfBase64;
}
