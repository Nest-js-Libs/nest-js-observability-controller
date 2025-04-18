import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TracingConfig } from './tracing.config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  BatchSpanProcessor,
  SpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import {
  HttpInstrumentation,
  HttpInstrumentationConfig,
} from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { MySQLInstrumentation } from '@opentelemetry/instrumentation-mysql';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { trace, SpanStatusCode, Span, propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { InstrumentationOption } from '@opentelemetry/instrumentation';

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject('TRACING_OPTIONS')
    private readonly options?: Partial<TracingConfig>,
  ) {
    const config = this.getConfig();

    if (config.enabled) {
      this.logger.log(
        `Inicializando OpenTelemetry con exportador: ${config.exporter}`,
      );

      // Configurar el recurso con metadatos del servicio
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]:
          config.serviceVersion || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      });

      // Configurar propagadores para contexto distribuido
      propagation.setGlobalPropagator(new W3CTraceContextPropagator());

      // Inicialización perezosa de instrumentaciones para mejorar el rendimiento de arranque
      const getInstrumentations = () => {
        const instrumentations: InstrumentationOption[] = [
          // Instrumentación de NestJS siempre habilitada
          new NestInstrumentation(),
        ];

        // Instrumentación HTTP condicional
        if (config.instrumentHttp) {
          this.logger.debug('Habilitando instrumentación HTTP');
          instrumentations.push(
            new HttpInstrumentation({
              ignoreIncomingPaths: ['/health', '/metrics'], // Ignorar rutas de monitoreo
            } as HttpInstrumentationConfig),
            new ExpressInstrumentation(),
          );
        }

        // Instrumentación de bases de datos condicional
        if (config.instrumentDb) {
          this.logger.debug('Habilitando instrumentación de bases de datos');
          instrumentations.push(
            new PgInstrumentation(),
            new MongoDBInstrumentation(),
            new MySQLInstrumentation(),
            new RedisInstrumentation(),
          );
        }

        // Instrumentación de sistemas de mensajería condicional
        if (config.instrumentMessaging) {
          this.logger.debug('Habilitando instrumentación de sistemas de mensajería');
          instrumentations.push(
            new AmqplibInstrumentation(),
            new KafkaJsInstrumentation(),
          );
        }

        return instrumentations;
      };

      // Configurar muestreador basado en ratio si está definido
      const sampler =
        config.samplingRatio !== undefined
          ? new ParentBasedSampler({
              root: new TraceIdRatioBasedSampler(config.samplingRatio),
            })
          : undefined;

      // Crear el SDK con todas las configuraciones
      this.sdk = new NodeSDK({
        resource,
        spanProcessor: this.createSpanProcessor(config) as any,
        instrumentations: getInstrumentations(),
        sampler,
      });

      // Inicializar el SDK inmediatamente
      this.startSdk();

      this.logger.log(
        `OpenTelemetry inicializado para servicio: ${config.serviceName}`,
      );
      this.logger.log(
        `Instrumentación HTTP: ${config.instrumentHttp ? 'Habilitada' : 'Deshabilitada'}`,
      );
      this.logger.log(
        `Instrumentación DB: ${config.instrumentDb ? 'Habilitada' : 'Deshabilitada'}`,
      );
      this.logger.log(
        `Instrumentación Mensajería: ${config.instrumentMessaging ? 'Habilitada' : 'Deshabilitada'}`,
      );
    } else {
      this.logger.log('OpenTelemetry está deshabilitado');
      // Crear un SDK vacío para evitar errores
      this.sdk = new NodeSDK({});
    }
  }

  private getConfig(): TracingConfig {
    const defaultConfig = this.configService.get<TracingConfig>('tracing');
    return { ...defaultConfig, ...this.options } as TracingConfig;
  }

  private createSpanProcessor(config: TracingConfig): SpanProcessor {
    let exporter;

    switch (config.exporter) {
      case 'jaeger':
        exporter = new JaegerExporter({
          endpoint: config.jaegerEndpoint,
        });
        this.logger.log(
          `Configurado exportador Jaeger con endpoint: ${config.jaegerEndpoint}`,
        );
        break;
      case 'zipkin':
        exporter = new ZipkinExporter({
          url: config.zipkinEndpoint,
        });
        this.logger.log(
          `Configurado exportador Zipkin con endpoint: ${config.zipkinEndpoint}`,
        );
        break;
      case 'otlp':
      default:
        exporter = new OTLPTraceExporter({
          url: `${config.otlpEndpoint}/v1/traces`,
        });
        this.logger.log(
          `Configurado exportador OTLP con endpoint: ${config.otlpEndpoint}`,
        );
        break;
    }

    // Obtener opciones para el procesador de spans
    const options = config.spanProcessorOptions || {};
    
    // Usar BatchSpanProcessor con opciones configurables para mejor rendimiento
    return new BatchSpanProcessor(exporter, {
      // Tamaño máximo del lote de spans a exportar de una vez
      maxExportBatchSize: options.maxExportBatchSize || 512,
      // Tiempo máximo (ms) para mantener spans en buffer antes de exportar
      scheduledDelayMillis: options.scheduledDelayMillis || 5000,
      // Tamaño máximo de la cola de spans en memoria
      maxQueueSize: options.maxQueueSize || 2048,
      // Tiempo máximo (ms) para exportar spans antes de cancelar durante apagado
      exportTimeoutMillis: options.exportTimeoutMillis || 30000,
    });
  }

  /**
   * Inicia el SDK de OpenTelemetry
   * @private
   */
  private async startSdk() {
    try {
      this.sdk.start();
      this.isInitialized = true;
      this.logger.log('SDK de OpenTelemetry iniciado correctamente');
    } catch (error) {
      this.logger.error('Error al iniciar el SDK de OpenTelemetry', error);
      // Intentar crear un SDK mínimo para evitar errores en la aplicación
      try {
        this.sdk = new NodeSDK({});
        this.logger.log('Creado SDK mínimo como fallback');
      } catch (fallbackError) {
        this.logger.error('No se pudo crear SDK mínimo', fallbackError);
      }
    }
  }

  /**
   * Método para limpiar recursos al detener la aplicación
   */
  async onApplicationShutdown() {
    if (this.isInitialized) {
      this.logger.log('Shutting down OpenTelemetry SDK');
      await this.sdk.shutdown();
    }
  }

  /**
   * Crea un nuevo span para rastrear una operación
   * @param name Nombre del span
   * @param attributes Atributos iniciales del span
   * @param options Opciones adicionales para el span
   * @returns El objeto Span creado
   */
  createSpan(
    name: string,
    attributes?: Record<string, any>,
    options?: {
      kind?: number; // SpanKind de OpenTelemetry
      links?: Array<{ context: any; attributes?: Record<string, any> }>;
    },
  ): Span {
    const config = this.getConfig();
    if (!config.enabled) {
      this.logger.debug(
        `Tracing deshabilitado, retornando span no-op para: ${name}`,
      );
      // Retornar un span no-op cuando el tracing está deshabilitado
      // Crear un objeto con los métodos necesarios para evitar errores
      return {
        setAttribute: (key: string, value: any) => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
    }

    try {
      const tracer = trace.getTracer('nest-app-tracer');

      // Crear el span con las opciones proporcionadas
      const span = tracer.startSpan(name, {
        kind: options?.kind,
        links: options?.links,
        attributes: {
          // Añadir atributos estándar
          'service.name': config.serviceName,
          'service.version': config.serviceVersion,
          environment: config.environment,
          // Añadir atributos personalizados si se proporcionan
          ...attributes,
        },
      });

      // Añadir atributos adicionales si se proporcionan
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Convertir objetos a JSON para mejor visualización
            if (typeof value === 'object' && value !== null) {
              try {
                span.setAttribute(key, JSON.stringify(value));
              } catch (e) {
                span.setAttribute(key, '[Object]');
              }
            } else {
              span.setAttribute(key, value);
            }
          }
        });
      }

      return span;
    } catch (error) {
      this.logger.error(`Error al crear span: ${error.message}`, error.stack);
      // Retornar un span no-op en caso de error con los métodos necesarios
      return {
        setAttribute: (key: string, value: any) => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {},
      } as unknown as Span;
    }
  }

  /**
   * Finaliza un span previamente creado
   * @param span El span a finalizar
   * @param success Indica si la operación fue exitosa
   * @param error Error opcional si la operación falló
   * @param attributes Atributos adicionales a añadir antes de finalizar el span
   */
  endSpan(
    span: Span,
    success: boolean,
    error?: Error,
    attributes?: Record<string, any>,
  ): void {
    if (!span) {
      return;
    }
    
    // Verificar que el span tenga los métodos necesarios
    const hasRequiredMethods = 
      typeof span.setAttribute === 'function' && 
      typeof span.setStatus === 'function' && 
      typeof span.end === 'function';
      
    if (!hasRequiredMethods) {
      this.logger.debug('Span no tiene los métodos requeridos, ignorando operación');
      return;
    }

    try {
      // Añadir atributos adicionales si se proporcionan
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Convertir objetos a JSON para mejor visualización
            if (typeof value === 'object' && value !== null) {
              try {
                span.setAttribute(key, JSON.stringify(value));
              } catch (e) {
                span.setAttribute(key, '[Object]');
              }
            } else {
              span.setAttribute(key, value);
            }
          }
        });
      }

      // Añadir información sobre el resultado
      span.setAttribute('operation.success', success);

      // Configurar el estado del span según el resultado
      if (success) {
        span.setStatus({
          code: SpanStatusCode.OK,
        });
      } else if (error) {
        // Registrar detalles del error
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);

        // Añadir atributos adicionales sobre el error
        span.setAttribute('error.type', error.name || 'Error');
        span.setAttribute('error.message', error.message);
        if (error.stack) {
          span.setAttribute('error.stack', error.stack);
        }
      } else {
        // Error sin detalles
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Unknown error',
        });
      }

      // Finalizar el span
      span.end();
    } catch (err) {
      this.logger.error(`Error al finalizar span: ${err.message}`, err.stack);
    }
  }

  /**
   * Ejecuta una función dentro de un span
   * @param name Nombre del span
   * @param fn Función a ejecutar dentro del span
   * @param options Opciones para el span
   * @returns El resultado de la función
   */
  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      attributes?: Record<string, any>;
      kind?: number;
      links?: Array<{ context: any; attributes?: Record<string, any> }>;
      resultAttributes?: (result: T) => Record<string, any>;
    },
  ): Promise<T> {
    const span = this.createSpan(name, options?.attributes, {
      kind: options?.kind,
      links: options?.links,
    });

    try {
      // Ejecutar la función con el span como argumento
      const result = await fn(span);

      // Añadir atributos basados en el resultado si se proporciona una función
      const resultAttrs = options?.resultAttributes
        ? options.resultAttributes(result)
        : undefined;

      // Finalizar el span con éxito
      this.endSpan(span, true, undefined, resultAttrs);

      return result;
    } catch (error) {
      // Finalizar el span con error
      this.endSpan(span, false, error);
      throw error;
    }
  }

  /**
   * Crea un span activo y lo establece como el span actual en el contexto
   * Útil para operaciones que necesitan propagar el contexto a través de llamadas asíncronas
   * @param name Nombre del span
   * @param fn Función a ejecutar dentro del contexto del span
   * @param attributes Atributos opcionales para el span
   * @returns El resultado de la función
   */
  async traceWithActiveSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const config = this.getConfig();
    if (!config.enabled) {
      return fn({} as Span);
    }

    const tracer = trace.getTracer('nest-app-tracer');

    return tracer.startActiveSpan(name, async span => {
      // Añadir atributos si se proporcionan
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            span.setAttribute(key, value);
          }
        });
      }

      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
