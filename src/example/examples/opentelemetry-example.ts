import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SpanKind } from '@opentelemetry/api';
import { InjectTracing, Trace } from 'src/lib/tracing/decorators';
import { TracingModule } from 'src/lib/tracing/tracing.module';
import { TracingService } from 'src/lib/tracing/tracing.service';

/**
 * Servicio de ejemplo que utiliza OpenTelemetry para rastrear operaciones
 */
@Injectable()
@InjectTracing()
class ExampleService {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * Método que utiliza el decorador @Trace para rastrear automáticamente
   */
  @Trace('example.operation', {
    attributes: { 'example.attribute': 'value' },
    kind: SpanKind.INTERNAL,
  })
  async performOperation(id: string): Promise<{ id: string; result: string }> {
    // Simular operación asíncrona
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id, result: 'Operación completada' };
  }

  /**
   * Método que utiliza el API de tracing directamente
   */
  async performComplexOperation(data: any): Promise<any> {
    return this.tracingService.trace(
      'complex.operation',
      async span => {
        // Añadir atributos al span
        span.setAttribute('operation.type', 'complex');
        span.setAttribute('data.size', JSON.stringify(data).length);

        // Simular operación de base de datos
        const dbResult = await this.simulateDatabaseQuery(data.id);

        // Simular operación de API externa
        const apiResult = await this.simulateApiCall(dbResult);

        return { ...dbResult, ...apiResult };
      },
      {
        // Opciones adicionales
        attributes: {
          'operation.id': data.id,
          'operation.name': 'complex-operation',
        },
        kind: SpanKind.INTERNAL,
      },
    );
  }

  /**
   * Simula una consulta a base de datos
   */
  private async simulateDatabaseQuery(id: string): Promise<any> {
    return this.tracingService.trace(
      'database.query',
      async _span => {
        // Simular latencia de base de datos
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id, dbField: 'value from database' };
      },
      {
        attributes: {
          'db.operation': 'SELECT',
          'db.statement': `SELECT * FROM items WHERE id = ${id}`,
          'db.system': 'postgresql',
        },
        kind: SpanKind.CLIENT,
      },
    );
  }

  /**
   * Simula una llamada a API externa
   */
  private async simulateApiCall(_data: any): Promise<any> {
    return this.tracingService.trace(
      'api.call',
      async _span => {
        // Simular latencia de API
        await new Promise(resolve => setTimeout(resolve, 75));
        return { apiField: 'value from external API' };
      },
      {
        attributes: {
          'http.method': 'GET',
          'http.url': 'https://api.example.com/data',
          'peer.service': 'example-api',
        },
        kind: SpanKind.CLIENT,
      },
    );
  }
}

/**
 * Controlador de ejemplo que utiliza el servicio con tracing
 */
@Controller('example')
@InjectTracing()
class ExampleController {
  constructor(
    private readonly exampleService: ExampleService,
    private readonly tracingService: TracingService,
  ) {}

  @Get()
  async getExample(): Promise<any> {
    // Crear un span manualmente para toda la operación
    const span = this.tracingService.createSpan(
      'example.controller.getExample',
      {
        'controller.operation': 'getExample',
      },
    );

    try {
      // Realizar operaciones con tracing
      const result1 = await this.exampleService.performOperation('123');
      const result2 = await this.exampleService.performComplexOperation({
        id: '456',
      });

      // Finalizar span con éxito
      this.tracingService.endSpan(span, true, undefined, {
        'results.count': 2,
      });

      return { result1, result2 };
    } catch (error) {
      // Finalizar span con error
      this.tracingService.endSpan(span, false, error);
      throw error;
    }
  }
}

/**
 * Módulo de ejemplo que configura OpenTelemetry
 */
@Module({
  imports: [
    // Configuración básica
    TracingModule.forRoot(),

    // Configuración avanzada
    /*
    TracingModule.forRootAsync({
      useFactory: () => ({
        enabled: true,
        serviceName: 'my-custom-service',
        exporter: 'jaeger',
        jaegerEndpoint: 'http://jaeger:14268/api/traces',
        instrumentHttp: true,
        instrumentDb: true,
        instrumentMessaging: false,
      }),
    }),
    */
  ],
  controllers: [ExampleController],
  providers: [ExampleService],
})
class ExampleModule {}

/**
 * Función principal para iniciar la aplicación con OpenTelemetry
 */
async function bootstrap() {
  const app = await NestFactory.create(ExampleModule);
  await app.listen(3000);
  console.log('Application with OpenTelemetry tracing is running on port 3000');
}
