package com.fhir.shared.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.util.Map;

@Configuration
@EnableJpaRepositories(
    basePackages = "com.fhir.hospitalB",
    entityManagerFactoryRef = "hospitalBEntityManagerFactory",
    transactionManagerRef = "hospitalBTransactionManager"
)
public class HospitalBJpaConfig {

    @Bean(name = "hospitalBEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean hospitalBEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("hospitalBDataSource") DataSource dataSource) {
        return builder
            .dataSource(dataSource)
            .packages("com.fhir.hospitalB.model")
            .persistenceUnit("hospitalB")
            .properties(Map.of(
                "hibernate.hbm2ddl.auto", "update",
                "hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect"
            ))
            .build();
    }

    @Bean(name = "hospitalBTransactionManager")
    public PlatformTransactionManager hospitalBTransactionManager(
            @Qualifier("hospitalBEntityManagerFactory")
            LocalContainerEntityManagerFactoryBean factory) {
        return new JpaTransactionManager(factory.getObject());
    }
}
