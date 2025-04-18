# Guía de Uso del Módulo de Tracing

Este documento proporciona ejemplos prácticos de cómo utilizar el módulo de Tracing con OpenTelemetry en tu aplicación NestJS.

## Configuración Inicial

Primero, asegúrate de importar el módulo `TracingModule` en tu módulo principal:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TracingModule } from './app/tracing';

@Module({
  imports: [
    TracingModule.forRoot(),
    // Otros módulos...
  ],
})
export class AppModule {}
```

## Configuración Personalizada

Puedes personalizar la configuración del módulo utilizando el método `forRootAsync`:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TracingModule } from './app/tracing';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TracingModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        enabled: configService.get('OTEL_ENABLED') === 'true',
        serviceName: configService.get('OTEL_SERVICE_NAME'),
        exporter: configService.get('OTEL_EXPORTER'),
      }),
      inject: [ConfigService],
    }),
    // Otros módulos...
  ],
})
export class AppModule {}
```

## Uso Básico con el Servicio de Tracing

### Inyección del Servicio

```typescript
// users.service.ts
import { Injectable } from '@nestjs/common';
import { TracingService } from '../app/tracing';

@Injectable()
export class UsersService {
  constructor(private readonly tracingService: TracingService) {}

  async findAll() {
    return this.tracingService.trace('users.findAll', async (span) => {
      // Añadir atributos al span
      span.setAttribute('operation.type', 'database.query');
      
      // Lógica para obtener usuarios
      const users = await this.usersRepository.find();
      
      // Añadir información sobre el resultado
      span.setAttribute('users.count', users.length);
      
      return users;
    });
  }
}
```

## Uso con Decoradores

Para una implementación más limpia, puedes utilizar los decoradores proporcionados:

```typescript
// products.service.ts
import { Injectable } from '@nestjs/common';
import { InjectTracing, Trace } from '../app/tracing';
import { TracingService } from '../app/tracing';

@Injectable()
@InjectTracing()
export class ProductsService {
  constructor(private readonly tracingService: TracingService) {}

  @Trace('products.findById', { attributes: { 'operation.type': 'database.query' } })
  async findById(id: string) {
    // La función se ejecutará automáticamente dentro de un span
    const product = await this.productsRepository.findOne(id);
    return product;
  }

  @Trace() // Usará el nombre del método como nombre del span
  async updateProduct(id: string, data: any) {
    return await this.productsRepository.update(id, data);
  }
}
```

## Uso del Interceptor de Tracing

Puedes aplicar el interceptor de tracing a nivel global o a controladores específicos:

### Aplicación Global

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TracingInterceptor } from './app/tracing/interceptors/tracing.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Obtener el servicio de tracing
  const tracingService = app.get(TracingService);
  
  // Aplicar el interceptor globalmente
  app.useGlobalInterceptors(new TracingInterceptor(tracingService));
  
  await app.listen(3000);
}
bootstrap();
```

### Aplicación a un Controlador Específico

```typescript
// orders.controller.ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { TracingInterceptor } from '../app/tracing/interceptors/tracing.interceptor';

@Controller('orders')
@UseInterceptors(TracingInterceptor)
export class OrdersController {
  // Métodos del controlador...
}
```

## Creación Manual de Spans

Para casos más complejos, puedes crear y gestionar spans manualmente:

```typescript
// payments.service.ts
import { Injectable } from '@nestjs/common';
import { TracingService } from '../app/tracing';

@Injectable()
export class PaymentsService {
  constructor(private readonly tracingService: TracingService) {}

  async processPayment(paymentData: any) {
    // Crear un span manualmente
    const span = this.tracingService.createSpan('payment.process', {
      'payment.amount': paymentData.amount,
      'payment.method': paymentData.method,
    });
    
    try {
      // Lógica para procesar el pago
      const result = await this.paymentGateway.process(paymentData);
      
      // Añadir información sobre el resultado
      span.setAttribute('payment.status', result.status);
      span.setAttribute('payment.transactionId', result.transactionId);
      
      // Finalizar el span con éxito
      this.tracingService.endSpan(span, true);
      
      return result;
    } catch (error) {
      // Finalizar el span con error
      this.tracingService.endSpan(span, false, error);
      throw error;
    }
  }
}
```

## Integración con Otros Módulos

### Ejemplo con HTTP Module

```typescript
// external-api.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '../app/http/http.service';
import { TracingService } from '../app/tracing';

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly tracingService: TracingService,
  ) {}

  async fetchData() {
    return this.tracingService.trace('external.api.fetch', async (span) => {
      span.setAttribute('external.api.name', 'example-api');
      
      const response = await this.httpService.get('https://api.example.com/data');
      
      span.setAttribute('external.api.status', response.status);
      span.setAttribute('external.api.items', response.data.length);
      
      return response.data;
    });
  }
}
```

### Ejemplo con Circuit Breaker

```typescript
// resilient.service.ts
import { Injectable } from '@nestjs/common';
import { CircuitBreaker } from '../app/circuit-breaker/decorators/circuit-breaker.decorator';
import { InjectTracing, Trace } from '../app/tracing';
import { TracingService } from '../app/tracing';

@Injectable()
@InjectTracing()
export class ResilientService {
  constructor(private readonly tracingService: TracingService) {}

  @CircuitBreaker('external-service')
  @Trace('resilient.operation')
  async performOperation() {
    // Esta operación está protegida por circuit breaker y trazada
    return await this.externalService.call();
  }
}
```

## Visualización de Trazas

Una vez que tu aplicación esté generando trazas, puedes visualizarlas utilizando:

1. **Jaeger UI**: Accesible en http://localhost:16686 (por defecto)
2. **Zipkin UI**: Accesible en http://localhost:9411 (por defecto)
3. **Grafana**: Configurable para visualizar datos de OpenTelemetry

## Consideraciones de Rendimiento

- Ajusta el nivel de muestreo (`OTEL_SAMPLING_RATIO`) en producción para reducir el volumen de datos
- Considera deshabilitar la instrumentación de componentes específicos si no son necesarios
- Monitorea el impacto en el rendimiento y ajusta la configuración según sea necesario