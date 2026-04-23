package com.fhir.shared.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Primary
    @Bean(name = "fhirMainDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.fhir-main")
    public DataSource fhirMainDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "hospitalADataSource")
    @ConfigurationProperties(prefix = "spring.datasource.hospital-a")
    public DataSource hospitalADataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "hospitalBDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.hospital-b")
    public DataSource hospitalBDataSource() {
        return DataSourceBuilder.create().build();
    }
}
