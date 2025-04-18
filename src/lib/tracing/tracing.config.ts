import { registerAs } from '@nestjs/config';

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;

  // Tipo de exportador a utilizar
  exporter: 'otlp' | 'jaeger' | 'zipkin';

  // Endpoints para los diferentes exportadores
  otlpEndpoint?: string;
  jaegerEndpoint?: string;
  zipkinEndpoint?: string;

  // Opciones de instrumentación
  instrumentHttp: boolean;
  instrumentDb: boolean;
  instrumentMessaging: boolean;

  // Opciones de muestreo
  samplingRatio?: number;
  
  // Opciones del procesador de spans en lotes
  spanProcessorOptions?: {
    // Tamaño máximo del lote antes de enviar
    maxExportBatchSize?: number;
    // Tiempo máximo en ms que los spans pueden permanecer en el buffer
    scheduledDelayMillis?: number;
    // Tamaño máximo del buffer en memoria
    maxQueueSize?: number;
    // Exportar todo en la finalización del proceso
    exportTimeoutMillis?: number;
  };
}

export default registerAs('tracing', () => ({
  enabled: process.env.OTEL_ENABLED === 'true',
  serviceName: process.env.OTEL_SERVICE_NAME || 'nest-template-definitive',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',

  // Tipo de exportador (por defecto OTLP)
  exporter: process.env.OTEL_EXPORTER || 'otlp',

  // Endpoints para los diferentes exportadores
  otlpEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  jaegerEndpoint:
    process.env.OTEL_EXPORTER_JAEGER_ENDPOINT ||
    'http://localhost:14268/api/traces',
  zipkinEndpoint:
    process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT ||
    'http://localhost:9411/api/v2/spans',

  // Opciones de instrumentación
  instrumentHttp: process.env.OTEL_INSTRUMENT_HTTP !== 'false',
  instrumentDb: process.env.OTEL_INSTRUMENT_DB !== 'false',
  instrumentMessaging: process.env.OTEL_INSTRUMENT_MESSAGING !== 'false',

  // Opciones de muestreo
  samplingRatio: parseFloat(process.env.OTEL_SAMPLING_RATIO || '1.0'),
  
  // Configuración del procesador de spans en lotes para optimizar rendimiento
  spanProcessorOptions: {
    maxExportBatchSize: parseInt(process.env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE || '512', 10),
    scheduledDelayMillis: parseInt(process.env.OTEL_BSP_SCHEDULED_DELAY_MILLIS || '5000', 10),
    maxQueueSize: parseInt(process.env.OTEL_BSP_MAX_QUEUE_SIZE || '2048', 10),
    exportTimeoutMillis: parseInt(process.env.OTEL_BSP_EXPORT_TIMEOUT_MILLIS || '30000', 10),
  },
}));
