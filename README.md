# NestJS Observability Controller

Este es un módulo para NestJS que proporciona una solución completa de observabilidad para microservicios, integrando **trazas**, **métricas** y **logs** basado en OpenTelemetry.

## Características

- ✅ **Trazabilidad completa**: Integración con OpenTelemetry para trazas distribuidas
- ✅ **Métricas de rendimiento**: Exportación a Prometheus para visualización en Grafana
- ✅ **Logs estructurados**: Correlación de logs con trazas y métricas
- ✅ **Interceptor HTTP**: Captura automática de métricas y trazas para todas las peticiones HTTP
- ✅ **Decoradores**: Fácil instrumentación de métodos específicos
- ✅ **Configuración flexible**: Adaptable a diferentes entornos y necesidades
- ✅ **Compatible con Kubernetes**: Diseñado para funcionar en entornos de contenedores

## Instalación

```bash
npm install @nest-js/observability-controller
```

## Dependencias

Este módulo utiliza OpenTelemetry, por lo que es necesario instalar las siguientes dependencias:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-prometheus @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-jaeger
```

## Uso Básico

### 1. Importar el módulo en tu aplicación

```typescript
import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@nest-js/observability-controller';

@Module({
  imports: [
    ObservabilityModule.register({
      serviceName: 'mi-servicio',
      serviceVersion: '1.0.0',
      environment: 'production',
      metrics: {
        enabled: true,
        prefix: 'mi_servicio_',
        prometheusEndpoint: '/metrics',
        port: 9464,
      },
      tracing: {
        enabled: true,
        exporters: {
          jaeger: {
            enabled: true,
            endpoint: 'http://jaeger:14268/api/traces',
          },
          otlp: {
            enabled: true,
            endpoint: 'http://collector:4318/v1/traces',
          },
        },
      },
      logging: {
        enabled: true,
        level: 'info',
        format: 'json',
        includeTraceContext: true,
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Utilizar el servicio de observabilidad en tus controladores o servicios

```typescript
import { Controller, Get } from '@nestjs/common';
import { ObservabilityService, Trace } from '@nest-js/observability-controller';

@Controller('api')
export class AppController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get()
  @Trace('get_home_endpoint') // Decorador para trazas automáticas
  getHello() {
    // Registrar un evento personalizado con trazas, métricas y logs correlacionados
    this.observabilityService.recordEvent('app.visited', { page: 'home' }, 'Usuario visitó la página principal');
    
    // También puedes acceder directamente a los servicios individuales
    this.observabilityService.logs.info('Solicitud a la página principal');
    this.observabilityService.metrics.getCounter('app.visits').add(1);
    
    return { message: 'Hello World!' };
  }
  
  @Get('error')
  testError() {
    try {
      throw new Error('Test error');
    } catch (error) {
      // Registrar un error con trazas, métricas y logs correlacionados
      this.observabilityService.recordError(error, 'AppController');
      throw error;
    }
  }
}
```

## Integración con Grafana, Jaeger, Prometheus y Loki

Este módulo está diseñado para integrarse con las siguientes herramientas:

### Prometheus (Métricas)

Las métricas se exponen automáticamente en el endpoint configurado (por defecto: `/metrics`).

### Jaeger (Trazas)

Las trazas se envían a Jaeger para visualización y análisis.

### Grafana (Visualización)

Puedes crear dashboards en Grafana utilizando las métricas de Prometheus y las trazas de Jaeger.

### Loki/Promtail (Logs)

Los logs estructurados pueden ser recogidos por Promtail y enviados a Loki para su visualización en Grafana.

## Configuración Avanzada

### Opciones completas de configuración

```typescript
ObservabilityModule.register({
  // Información del servicio
  serviceName: 'mi-servicio',
  serviceVersion: '1.0.0',
  environment: 'production',
  
  // Configuración de métricas
  metrics: {
    enabled: true,
    prefix: 'mi_servicio_',
    prometheusEndpoint: '/metrics',
    port: 9464,
    defaultLabels: {
      team: 'backend',
      app: 'api',
    },
  },
  
  // Configuración de trazas
  tracing: {
    enabled: true,
    exporters: {
      jaeger: {
        enabled: true,
        endpoint: 'http://jaeger:14268/api/traces',
      },
      otlp: {
        enabled: true,
        endpoint: 'http://collector:4318/v1/traces',
      },
    },
    sampling: {
      enabled: true,
      ratio: 0.5, // Muestreo del 50% de las trazas
    },
    instrumentations: {
      http: true,
      grpc: true,
      express: true,
      nestjs: true,
      redis: true,
      mongodb: true,
      postgres: true,
    },
  },
  
  // Configuración de logs
  logging: {
    enabled: true,
    level: 'info',
    format: 'json',
    exporters: {
      loki: {
        enabled: true,
        endpoint: 'http://loki:3100/loki/api/v1/push',
      },
      console: true,
      file: {
        enabled: true,
        path: '/var/log/app.log',
      },
    },
    includeTraceContext: true,
  },
});
```

## Ejemplo en Kubernetes

Para configurar correctamente tu aplicación en Kubernetes, puedes utilizar un ConfigMap para las variables de configuración:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: observability-config
data:
  OTEL_SERVICE_NAME: "mi-servicio"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318"
  PROMETHEUS_PORT: "9464"
  JAEGER_ENDPOINT: "http://jaeger:14268/api/traces"
  LOKI_ENDPOINT: "http://loki:3100/loki/api/v1/push"
```

Y luego usar estas variables en tu código:

```typescript
ObservabilityModule.register({
  serviceName: process.env.OTEL_SERVICE_NAME,
  metrics: {
    port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
  },
  tracing: {
    exporters: {
      jaeger: {
        endpoint: process.env.JAEGER_ENDPOINT,
      },
    },
  },
  // ...resto de configuración
});
```

## Licencia

MIT
