/**
 * Tipos y interfaces para el módulo de Tracing
 */
import { SpanKind } from '@opentelemetry/api';

/**
 * Opciones para el span personalizado
 */
export interface SpanOptions {
  /**
   * Atributos adicionales para el span
   */
  attributes?: Record<string, any>;

  /**
   * Si se debe finalizar automáticamente el span al completar la función
   * @default true
   */
  autoEnd?: boolean;

  /**
   * Tipo de span (CLIENT, SERVER, PRODUCER, CONSUMER, INTERNAL)
   * @default SpanKind.INTERNAL
   */
  kind?: SpanKind;

  /**
   * Enlaces a otros spans relacionados
   */
  links?: Array<{ context: any; attributes?: Record<string, any> }>;
}

/**
 * Tipos de exportadores soportados
 */
export type ExporterType = 'jaeger' | 'zipkin' | 'otlp';

/**
 * Estado del span
 */
export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
}

/**
 * Nivel de severidad para eventos de span
 */
export enum SpanEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}
