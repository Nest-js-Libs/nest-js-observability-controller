import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OBSERVABILITY_CONFIG_OPTIONS } from '../constants';
import { ObservabilityModuleOptions } from '../interfaces/observability-options.interface';
import {
  trace,
  context,
  Tracer,
  Span,
  SpanStatusCode,
  SpanOptions,
  SpanKind,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TracingService.name);
  private tracer: Tracer;
  private sdk: NodeSDK;
  private provider: NodeTracerProvider;
  private initialized = false;

  constructor(
    @Inject(OBSERVABILITY_CONFIG_OPTIONS) private readonly options: ObservabilityModuleOptions,
  ) {
    this.initialize();
  }

  onModuleInit() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('OpenTelemetry SDK shut down successfully');
    }
  }

  private initialize() {
    try {
      const tracingEnabled = this.options.tracing?.enabled !== false;
      if (!tracingEnabled) {
        this.logger.log('Tracing is disabled');
        return;
      }

      // Crear el proveedor de trazas
      this.provider = new NodeTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName || 'nest-app',
          [SemanticResourceAttributes.SERVICE_VERSION]: this.options.serviceVersion || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.options.environment || 'development',
        }),
      });

      // Configurar exportadores
      this.configureExporters();

      // Registrar el proveedor
      this.provider.register({
        propagator: new W3CTraceContextPropagator(),
      });

      // Obtener el tracer
      this.tracer = trace.getTracer(this.options.serviceName || 'nest-app');

      // Configurar SDK con instrumentaciones automáticas
      this.configureSDK();

      this.initialized = true;
      this.logger.log('Tracing service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize tracing service', error);
    }
  }

  private configureExporters() {
    const jaegerEnabled = this.options.tracing?.exporters?.jaeger?.enabled !== false;
    const otlpEnabled = this.options.tracing?.exporters?.otlp?.enabled !== false;

    if (jaegerEnabled) {
      const jaegerExporter = new JaegerExporter({
        endpoint: this.options.tracing?.exporters?.jaeger?.endpoint || 'http://localhost:14268/api/traces',
      });
      this.provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
      this.logger.log('Jaeger exporter configured');
    }

    if (otlpEnabled) {
      const otlpExporter = new OTLPTraceExporter({
        url: this.options.tracing?.exporters?.otlp?.endpoint || 'http://localhost:4318/v1/traces',
      });
      this.provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
      this.logger.log('OTLP exporter configured');
    }

    // Si no hay exportadores configurados, usar SimpleSpanProcessor con consola para desarrollo
    if (!jaegerEnabled && !otlpEnabled) {
      const consoleExporter = new ConsoleSpanExporter();
      this.provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter));
      this.logger.log('Console exporter configured (default)');
    }
  }

  private configureSDK() {
    const instrumentations = [];

    // Añadir instrumentaciones basadas en la configuración
    if (this.options.tracing?.instrumentations) {
      const {
        http,
        grpc,
        express,
        nestjs,
        graphql,
        redis,
        mongodb,
        mysql,
        postgres,
      } = this.options.tracing.instrumentations;

      // Por defecto, activar las instrumentaciones básicas
      instrumentations.push(
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': http !== false ? {} : { enabled: false },
          '@opentelemetry/instrumentation-grpc': grpc === true ? {} : { enabled: false },
          '@opentelemetry/instrumentation-express': express !== false ? {} : { enabled: false },
          '@opentelemetry/instrumentation-nestjs-core': nestjs !== false ? {} : { enabled: false },
          '@opentelemetry/instrumentation-graphql': graphql === true ? {} : { enabled: false },
          '@opentelemetry/instrumentation-redis': redis === true ? {} : { enabled: false },
          '@opentelemetry/instrumentation-mongodb': mongodb === true ? {} : { enabled: false },
          '@opentelemetry/instrumentation-mysql': mysql === true ? {} : { enabled: false },
          '@opentelemetry/instrumentation-pg': postgres === true ? {} : { enabled: false },
        }),
      );
    } else {
      // Si no hay configuración específica, activar las instrumentaciones básicas
      instrumentations.push(getNodeAutoInstrumentations());
    }

    // Configurar muestreo si está especificado
    const samplingRatio = this.options.tracing?.sampling?.ratio || 1.0;

    // Inicializar y arrancar el SDK
    this.sdk = new NodeSDK({
      instrumentations,
    });

    this.sdk.start();
    this.logger.log('OpenTelemetry SDK started');
  }

  /**
   * Inicia un nuevo span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    if (!this.initialized) {
      // Devolver un span noop si el servicio no está inicializado
      return trace.getTracer('noop').startSpan('noop');
    }
    return this.tracer.startSpan(name, options);
  }

  /**
   * Obtiene el span actual del contexto
   */
  getCurrentSpan(): Span | undefined {
    if (!this.initialized) {
      return undefined;
    }
    return trace.getSpan(context.active());
  }

  /**
   * Ejecuta una función dentro de un span
   */
  async traceAsync<T>(name: string, fn: (span: Span) => Promise<T>, kind?: SpanKind): Promise<T> {
    if (!this.initialized) {
      return fn(trace.getTracer('noop').startSpan('noop'));
    }

    const span = this.tracer.startSpan(name, { kind });
    try {
      return await context.with(trace.setSpan(context.active(), span), async () => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        } finally {
          span.end();
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Ejecuta una función síncrona dentro de un span
   */
  trace<T>(name: string, fn: (span: Span) => T, kind?: SpanKind): T {
    if (!this.initialized) {
      return fn(trace.getTracer('noop').startSpan('noop'));
    }

    const span = this.tracer.startSpan(name, { kind });
    try {
      return context.with(trace.setSpan(context.active(), span), () => {
        try {
          const result = fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        } finally {
          span.end();
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Añade un evento al span actual
   */
  addEvent(name: string, attributes?: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Añade atributos al span actual
   */
  setAttributes(attributes: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Marca el span actual como error
   */
  setError(error: Error | string) {
    const span = this.getCurrentSpan();
    if (span) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : error,
      });
      span.recordException(error instanceof Error ? error : new Error(error));
    }
  }
}

// Esta clase se necesita ya que no está disponible directamente en @opentelemetry/api
class ConsoleSpanExporter {
  export(spans, resultCallback) {
    for (const span of spans) {
      console.log(JSON.stringify(span.toJSON(), null, 2));
    }
    resultCallback({ code: 0 });
  }

  shutdown() {
    return Promise.resolve();
  }
} 