# Módulo de Tracing con OpenTelemetry para NestJS

Este módulo proporciona integración con OpenTelemetry para implementar trazabilidad distribuida en aplicaciones NestJS.

## Características

- **Instrumentación Automática**: Captura automática de trazas para HTTP, bases de datos y mensajería
- **Exportadores Múltiples**: Soporte para Jaeger, Zipkin y Prometheus
- **Contexto Propagado**: Mantiene el contexto de trazabilidad a través de servicios distribuidos
- **Atributos Personalizados**: Permite añadir metadatos específicos de negocio a las trazas
- **Métricas Integradas**: Recopilación de métricas de rendimiento junto con las trazas
- **Configuración Flexible**: Personalizable mediante variables de entorno

## Instalación

El módulo viene preinstalado en el template. Si necesitas instalarlo manualmente:

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/sdk-metrics
```

## Configuración

Configura el módulo en tu archivo `.env`:

```env
# Configuración básica
OTEL_ENABLED=true
OTEL_SERVICE_NAME=mi-servicio

# Exportador (jaeger, zipkin, otlp)
OTEL_EXPORTER=jaeger

# Configuración de Jaeger
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Configuración de Zipkin
OTEL_EXPORTER_ZIPKIN_ENDPOINT=http://localhost:9411/api/v2/spans

# Configuración de OTLP (OpenTelemetry Protocol)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Nivel de muestreo (1.0 = 100% de las trazas)
OTEL_SAMPLING_RATIO=1.0
```

## Uso Básico

El módulo se inicializa automáticamente antes de que la aplicación NestJS comience, instrumentando automáticamente las solicitudes HTTP, conexiones de base de datos y más.

### Crear Spans Personalizados

```typescript
import { TraceService } from './app/tracing/tracing.service';

@Injectable()
export class MiServicio {
  constructor(private readonly traceService: TraceService) {}

  async realizarOperacion() {
    // Crear un span personalizado
    return this.traceService.trace('operacion.personalizada', async (span) => {
      // Añadir atributos al span
      span.setAttribute('operacion.tipo', 'procesamiento-datos');
      
      // Tu lógica aquí
      const resultado = await this.procesarDatos();
      
      // Añadir más atributos basados en el resultado
      span.setAttribute('operacion.resultado', resultado.estado);
      
      return resultado;
    });
  }
}
```

## Visualización

Puedes visualizar las trazas utilizando:

- **Jaeger UI**: Accesible típicamente en http://localhost:16686
- **Zipkin UI**: Accesible típicamente en http://localhost:9411
- **Grafana**: Configurable para visualizar datos de OpenTelemetry

## Integración con Otros Módulos

Este módulo se integra perfectamente con otros módulos del template:

- **HTTP Module**: Trazas automáticas para solicitudes HTTP salientes
- **Circuit Breaker**: Trazas para operaciones con circuit breaker
- **Cache**: Visibilidad de operaciones de caché
- **Events**: Trazabilidad a través de eventos asíncronos

## Consideraciones de Rendimiento

La instrumentación de OpenTelemetry añade una sobrecarga mínima, pero considera ajustar el nivel de muestreo en producción para reducir el volumen de datos si es necesario.

## Rendimiento y Optimización

- **Impacto en memoria**: El módulo añade aproximadamente 10-20MB de uso de memoria adicional dependiendo del volumen de trazas.
- **Latencia adicional**: Mediciones muestran un impacto de 1-3ms por solicitud en entornos de producción típicos.
- **Recomendaciones**: 
  - En producción, considera usar `OTEL_SAMPLING_RATIO=0.1` (10% de las trazas) para reducir costos y sobrecarga.
  - Para aplicaciones de alto rendimiento, desactiva instrumentación de componentes no críticos.
  - Configura adecuadamente los procesadores de spans para enviar en lotes eficientes.

## Solución de Problemas Comunes

### Las trazas no aparecen en el visualizador

1. Verifica que `OTEL_ENABLED=true` en tu configuración.
2. Comprueba que el exportador está correctamente configurado y accesible (puertos, firewall, etc.).
3. Asegúrate de que el servicio del backend (Jaeger, Zipkin, etc.) está funcionando.

### Pérdida de contexto entre servicios

1. Verifica que los encabezados de propagación (`traceparent`, `tracestate`) se están transmitiendo correctamente.
2. Asegúrate de que todos los servicios usan configuraciones compatibles de OpenTelemetry.

### Alto uso de recursos

1. Reduce el ratio de muestreo (`OTEL_SAMPLING_RATIO`).
2. Utiliza el BatchSpanProcessor con configuración optimizada.
3. Considera desactivar instrumentaciones específicas que no sean críticas.

### Errores en la inicialización

Si encuentras errores al iniciar la aplicación:
1. Verifica las dependencias y versiones de OpenTelemetry.
2. Asegúrate de que las configuraciones del exportador sean correctas.
3. Revisa los logs detallados para mensajes específicos de error.