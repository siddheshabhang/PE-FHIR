package com.fhir.admin.controller;

import com.fhir.admin.service.AdminService;
import com.fhir.shared.audit.TransferAuditLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/transfers")
    public List<TransferAuditLog> getAllTransfers() {
        return adminService.getAllTransfers();
    }

    @GetMapping("/audit-logs")
    public List<Map<String, Object>> getAuditLogs() {
        return adminService.getAuditLogs();
    }

    @GetMapping("/system-health")
    public List<Map<String, Object>> getSystemHealth() {
        return adminService.getSystemHealth();
    }
}
