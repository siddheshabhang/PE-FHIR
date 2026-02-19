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

    public static class Vitals {
        private String bp;
        private String temp;

        public String getBp() {
            return bp;
        }

        public void setBp(String bp) {
            this.bp = bp;
        }

        public String getTemp() {
            return temp;
        }

        public void setTemp(String temp) {
            this.temp = temp;
        }
    }
}
