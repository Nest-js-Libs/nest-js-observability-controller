import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../lib/observability.module";

@Module({
    imports: [
        ObservabilityModule.register({
            serviceName: 'example-service',
            serviceVersion: '1.0.0',
            environment: 'development',
            metrics: {
                enabled: true,
                prefix: 'example_',
                prometheusEndpoint: '/metrics',
                port: 9464,
            },
            tracing: {
                enabled: true,
                exporters: {
                    jaeger: {
                        enabled: true,
                        endpoint: 'http://localhost:14268/api/traces',
                    },
                    otlp: {
                        enabled: true,
                        endpoint: 'http://localhost:4318/v1/traces',
                    },
                },
                instrumentations: {
                    http: true,
                    express: true,
                    nestjs: true,
                },
            },
            logging: {
                enabled: true,
                level: 'debug',
                format: 'json',
                includeTraceContext: true,
            },
        }),
    ],
    controllers: [],
    providers: [],
})
export class ExampleModule {}