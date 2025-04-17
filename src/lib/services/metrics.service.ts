import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OBSERVABILITY_CONFIG_OPTIONS, METRICS } from '../constants';
import { ObservabilityModuleOptions } from '../interfaces/observability-options.interface';
import { metrics, Meter, Counter, Histogram, UpDownCounter, ObservableGauge } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private meter: Meter;
  private meterProvider: MeterProvider;
  private prometheusExporter: PrometheusExporter;
  private initialized = false;
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private upDownCounters: Map<string, UpDownCounter> = new Map();
  private observableGauges: Map<string, ObservableGauge> = new Map();

  constructor(
    @Inject(OBSERVABILITY_CONFIG_OPTIONS) private readonly options: ObservabilityModuleOptions,
  ) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    try {
      const metricsEnabled = this.options.metrics?.enabled !== false;
      if (!metricsEnabled) {
        this.logger.log('Metrics are disabled');
        return;
      }

      // Configurar el recurso con metadatos del servicio
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName || 'nest-app',
        [SemanticResourceAttributes.SERVICE_VERSION]: this.options.serviceVersion || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.options.environment || 'development',
        ...this.options.metrics?.defaultLabels || {},
      });

      // Configurar el exportador de Prometheus
      this.prometheusExporter = new PrometheusExporter({
        endpoint: this.options.metrics?.prometheusEndpoint || '/metrics',
        port: this.options.metrics?.port || 9464,
      });

      // Crear el proveedor de métricas
      this.meterProvider = new MeterProvider({
        resource,
      });

      // Registrar el exportador de Prometheus
      this.meterProvider.addMetricReader(this.prometheusExporter as unknown as MetricReader);

      // Configurar el meter global y obtener una instancia
      metrics.setGlobalMeterProvider(this.meterProvider);
      this.meter = metrics.getMeter(this.options.serviceName || 'nest-app');

      this.initialized = true;
      this.logger.log(`Prometheus metrics available at http://localhost:${this.options.metrics?.port || 9464}${this.options.metrics?.prometheusEndpoint || '/metrics'}`);
      this.logger.log('Metrics service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize metrics service', error);
    }
  }

  /**
   * Obtiene o crea un contador
   */
  getCounter(name: string, options?: { description?: string, unit?: string }): Counter {
    if (!this.initialized) {
      return {
        add: () => {}, // Operación nula si no está inicializado
      } as Counter;
    }

    const key = this.getMetricKey(name);
    if (!this.counters.has(key)) {
      const counter = this.meter.createCounter(key, {
        description: options?.description || `Counter for ${name}`,
        unit: options?.unit || '1',
      });
      this.counters.set(key, counter);
    }
    return this.counters.get(key);
  }

  /**
   * Obtiene o crea un histograma
   */
  getHistogram(name: string, options?: { description?: string, unit?: string, boundaries?: number[] }): Histogram {
    if (!this.initialized) {
      return {
        record: () => {}, // Operación nula si no está inicializado
      } as Histogram;
    }

    const key = this.getMetricKey(name);
    if (!this.histograms.has(key)) {
      const histogram = this.meter.createHistogram(key, {
        description: options?.description || `Histogram for ${name}`,
        unit: options?.unit || 'ms',
      });
      this.histograms.set(key, histogram);
    }
    return this.histograms.get(key);
  }

  /**
   * Obtiene o crea un contador bidireccional
   */
  getUpDownCounter(name: string, options?: { description?: string, unit?: string }): UpDownCounter {
    if (!this.initialized) {
      return {
        add: () => {}, // Operación nula si no está inicializado
      } as UpDownCounter;
    }

    const key = this.getMetricKey(name);
    if (!this.upDownCounters.has(key)) {
      const upDownCounter = this.meter.createUpDownCounter(key, {
        description: options?.description || `UpDownCounter for ${name}`,
        unit: options?.unit || '1',
      });
      this.upDownCounters.set(key, upDownCounter);
    }
    return this.upDownCounters.get(key);
  }

  /**
   * Obtiene o crea un medidor observable
   */
  getObservableGauge(name: string, callback: () => number, options?: { description?: string, unit?: string }): ObservableGauge {
    if (!this.initialized) {
      return {} as ObservableGauge;
    }

    const key = this.getMetricKey(name);
    if (!this.observableGauges.has(key)) {
      const gauge = this.meter.createObservableGauge(key, {
        description: options?.description || `Gauge for ${name}`,
        unit: options?.unit || '1',
      });
      
      gauge.addCallback((observableResult) => {
        observableResult.observe(callback());
      });
      
      this.observableGauges.set(key, gauge);
    }
    return this.observableGauges.get(key);
  }

  /**
   * Registra un valor en la métrica de duración HTTP
   */
  recordHttpRequestDuration(duration: number, attributes: Record<string, string> = {}) {
    if (!this.initialized) return;

    const histogram = this.getHistogram(METRICS.HTTP_REQUEST_DURATION);
    histogram.record(duration, attributes);
  }

  /**
   * Incrementa el contador de solicitudes HTTP totales
   */
  incrementHttpRequestTotal(attributes: Record<string, string> = {}) {
    if (!this.initialized) return;

    const counter = this.getCounter(METRICS.HTTP_REQUEST_TOTAL);
    counter.add(1, attributes);
  }

  /**
   * Incrementa el contador de errores HTTP
   */
  incrementHttpErrorTotal(attributes: Record<string, string> = {}) {
    if (!this.initialized) return;

    const counter = this.getCounter(METRICS.HTTP_ERROR_TOTAL);
    counter.add(1, attributes);
  }

  /**
   * Registra el tamaño de la solicitud HTTP
   */
  recordHttpRequestSize(size: number, attributes: Record<string, string> = {}) {
    if (!this.initialized) return;

    const histogram = this.getHistogram(METRICS.HTTP_REQUEST_SIZE, { unit: 'By' });
    histogram.record(size, attributes);
  }

  /**
   * Registra el tamaño de la respuesta HTTP
   */
  recordHttpResponseSize(size: number, attributes: Record<string, string> = {}) {
    if (!this.initialized) return;

    const histogram = this.getHistogram(METRICS.HTTP_RESPONSE_SIZE, { unit: 'By' });
    histogram.record(size, attributes);
  }

  /**
   * Genera la clave para la métrica con el prefijo configurado
   */
  private getMetricKey(name: string): string {
    const prefix = this.options.metrics?.prefix || '';
    return prefix ? `${prefix}${name}` : name;
  }
} 