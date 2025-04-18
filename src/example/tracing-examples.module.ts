import { Module } from '@nestjs/common';
import { BasicTracingController } from './basic.controller';
import { HttpTracingController } from './http.controller';
import { DatabaseTracingController } from './database.controller';
import { AsyncTracingController } from './async.controller';
import { TracingModule } from 'src/lib/tracing/tracing.module';
import { HttpModule } from '@nestjs/axios';
import { PrometheusModule } from 'src/lib/prometheus';

// setear variables de entorno para el ejemplo de tracing
// OPCIONAL: Para ejecutar el ejemplo de tracing, se debe setear las siguientes variables de entorno:
process.env.OTEL_ENABLED='true'
process.env.OTEL_SERVICE_NAME='@nest-js/observability-controller'
process.env.SERVICE_VERSION='1.0.0'
process.env.OTEL_EXPORTER='jaeger'
process.env.OTEL_EXPORTER_JAEGER_ENDPOINT='http://localhost:14268/api/traces'

process.env.OTEL_INSTRUMENT_HTTP='true'
process.env.OTEL_INSTRUMENT_DB='true'
process.env.OTEL_INSTRUMENT_MESSAGING='true'

process.env.OTEL_SAMPLING_RATIO='1.0'



/**
 * Módulo que incluye ejemplos de controladores que utilizan el sistema de tracing
 * Este módulo es opcional y solo debe importarse cuando se deseen utilizar los
 * controladores de ejemplo.
 */
@Module({
  imports: [
    TracingModule.forRoot(), 
    HttpModule, 
    PrometheusModule,
  ],
  controllers: [
    BasicTracingController,
    HttpTracingController,
    DatabaseTracingController,
    AsyncTracingController,
  ],
  providers: [],
})
export class TracingExamplesModule { }
