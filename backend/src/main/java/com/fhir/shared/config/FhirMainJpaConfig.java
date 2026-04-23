package com.fhir.shared.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.util.Map;

@Configuration
@EnableJpaRepositories(
    basePackages = {
        "com.fhir.auth.repository",
        "com.fhir.consent.repository",
        "com.fhir.identity.repository",
        "com.fhir.shared.audit",
        "com.fhir.admin"
    },
    entityManagerFactoryRef = "fhirMainEntityManagerFactory",
    transactionManagerRef = "fhirMainTransactionManager"
)
public class FhirMainJpaConfig {

    @Primary
    @Bean(name = "fhirMainEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean fhirMainEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("fhirMainDataSource") DataSource dataSource) {
        return builder
            .dataSource(dataSource)
            .packages(
                "com.fhir.auth.model",
                "com.fhir.consent.model",
                "com.fhir.identity.model",
                "com.fhir.shared.audit"
            )
            .persistenceUnit("fhirMain")
            .properties(Map.of(
                "hibernate.hbm2ddl.auto", "update",
                "hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect"
            ))
            .build();
    }

    @Primary
    @Bean(name = "fhirMainTransactionManager")
    public PlatformTransactionManager fhirMainTransactionManager(
            @Qualifier("fhirMainEntityManagerFactory")
            LocalContainerEntityManagerFactoryBean factory) {
        return new JpaTransactionManager(factory.getObject());
    }
}
