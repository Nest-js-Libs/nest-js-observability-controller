import { Inject, Injectable, Logger, LogLevel, OnModuleInit } from '@nestjs/common';
import { OBSERVABILITY_CONFIG_OPTIONS, LOG_LEVEL } from '../constants';
import { ObservabilityModuleOptions } from '../interfaces/observability-options.interface';
import { context, trace } from '@opentelemetry/api';

@Injectable()
export class LoggingService implements OnModuleInit {
  private readonly logger = new Logger(LoggingService.name);
  private initialized = false;

  constructor(
    @Inject(OBSERVABILITY_CONFIG_OPTIONS) private readonly options: ObservabilityModuleOptions,
  ) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    try {
      const loggingEnabled = this.options.logging?.enabled !== false;
      if (!loggingEnabled) {
        this.logger.log('Logging service is disabled');
        return;
      }

      // Configuración básica - en este punto podríamos configurar exportadores específicos
      // como Winston, Pino, etc. según la necesidad
      
      this.initialized = true;
      this.logger.log('Logging service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize logging service', error);
    }
  }

  /**
   * Registra un mensaje de debug
   */
  debug(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LOG_LEVEL.DEBUG, message, context, metadata);
  }

  /**
   * Registra un mensaje informativo
   */
  info(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LOG_LEVEL.INFO, message, context, metadata);
  }

  /**
   * Registra una advertencia
   */
  warn(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LOG_LEVEL.WARN, message, context, metadata);
  }

  /**
   * Registra un error
   */
  error(message: string, trace?: string, context?: string, metadata?: Record<string, any>) {
    this.log(LOG_LEVEL.ERROR, message, context, { ...metadata, trace });
  }

  /**
   * Registra un error fatal
   */
  fatal(message: string, trace?: string, context?: string, metadata?: Record<string, any>) {
    this.log(LOG_LEVEL.FATAL, message, context, { ...metadata, trace });
  }

  /**
   * Método genérico para registrar logs con información de trazas
   */
  private log(level: string, message: string, contextName?: string, metadata?: Record<string, any>) {
    if (!this.initialized) {
      // Si el servicio no está inicializado, usar el logger estándar de NestJS
      const nestLogger = new Logger(contextName || 'Application');
      this.logWithNestLogger(nestLogger, level, message, metadata);
      return;
    }

    const logData = this.enrichLogData(message, contextName, metadata);
    this.logToConsole(level, logData);
    
    // Aquí se podría agregar la lógica para enviar los logs a Loki/Promtail
    // o cualquier otro exportador si está configurado
  }

  /**
   * Enriquece los datos de log con información de trazas y metadatos
   */
  private enrichLogData(message: string, contextName?: string, metadata?: Record<string, any>): Record<string, any> {
    const activeSpan = trace.getSpan(context.active());
    let spanContext;
    
    if (activeSpan) {
      spanContext = activeSpan.spanContext();
    }

    return {
      message,
      timestamp: new Date().toISOString(),
      context: contextName || 'Application',
      service: this.options.serviceName || 'nest-app',
      environment: this.options.environment || 'development',
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      ...metadata,
    };
  }

  /**
   * Registra con el logger estándar de NestJS
   */
  private logWithNestLogger(logger: Logger, level: string, message: string, metadata?: Record<string, any>) {
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    
    switch (level) {
      case LOG_LEVEL.DEBUG:
        logger.debug(`${message}${metadataStr}`);
        break;
      case LOG_LEVEL.INFO:
        logger.log(`${message}${metadataStr}`);
        break;
      case LOG_LEVEL.WARN:
        logger.warn(`${message}${metadataStr}`);
        break;
      case LOG_LEVEL.ERROR:
        logger.error(`${message}${metadataStr}`, metadata?.trace);
        break;
      case LOG_LEVEL.FATAL:
        logger.error(`[FATAL] ${message}${metadataStr}`, metadata?.trace);
        break;
      default:
        logger.log(`${message}${metadataStr}`);
    }
  }

  /**
   * Registra en consola con formato estructurado
   */
  private logToConsole(level: string, data: Record<string, any>) {
    const { message, ...metadata } = data;
    
    switch (level) {
      case LOG_LEVEL.DEBUG:
        console.debug(message, metadata);
        break;
      case LOG_LEVEL.INFO:
        console.info(message, metadata);
        break;
      case LOG_LEVEL.WARN:
        console.warn(message, metadata);
        break;
      case LOG_LEVEL.ERROR:
      case LOG_LEVEL.FATAL:
        console.error(message, metadata);
        break;
      default:
        console.log(message, metadata);
    }
  }
} 