import { Inject, Injectable, Logger } from '@nestjs/common';
import { OBSERVABILITY_CONFIG_OPTIONS } from '../constants';
import { ObservabilityModuleOptions } from '../interfaces/observability-options.interface';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    @Inject(OBSERVABILITY_CONFIG_OPTIONS) private readonly options: ObservabilityModuleOptions,
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
  ) {
    this.logger.log(`Observability service initialized for service: ${options.serviceName || 'nest-app'}`);
  }

  /**
   * Registra un evento con trazas, métricas y logs correlacionados
   */
  recordEvent(name: string, attributes: Record<string, any> = {}, message?: string) {
    // Registra el evento como una métrica
    const counter = this.metricsService.getCounter(`event.${name}.count`);
    counter.add(1, attributes);

    // Añade el evento al span actual
    this.tracingService.addEvent(name, attributes);

    // Registra el evento como un log
    this.loggingService.info(
      message || `Event: ${name}`, 
      this.options.serviceName,
      { eventName: name, ...attributes }
    );
  }

  /**
   * Registra un error con trazas, métricas y logs correlacionados
   */
  recordError(error: Error, context?: string, attributes: Record<string, any> = {}) {
    // Incrementa el contador de errores
    const counter = this.metricsService.getCounter(`error.${context || 'application'}.count`);
    counter.add(1, attributes);

    // Marca el span actual como error
    this.tracingService.setError(error);

    // Registra el error en los logs
    this.loggingService.error(
      error.message,
      error.stack,
      context || this.options.serviceName,
      attributes
    );
  }

  /**
   * Mide la duración de una operación
   */
  measureDuration(name: string, duration: number, attributes: Record<string, any> = {}) {
    const histogram = this.metricsService.getHistogram(`duration.${name}`);
    histogram.record(duration, attributes);
  }

  /**
   * Registra una métrica personalizada como gauge
   */
  recordGaugeMetric(name: string, value: number, attributes: Record<string, any> = {}) {
    const callback = () => value;
    this.metricsService.getObservableGauge(name, callback);
  }

  /**
   * Obtiene el servicio de logs para uso directo
   */
  get logs(): LoggingService {
    return this.loggingService;
  }

  /**
   * Obtiene el servicio de métricas para uso directo
   */
  get metrics(): MetricsService {
    return this.metricsService;
  }

  /**
   * Obtiene el servicio de trazas para uso directo
   */
  get tracing(): TracingService {
    return this.tracingService;
  }
} 