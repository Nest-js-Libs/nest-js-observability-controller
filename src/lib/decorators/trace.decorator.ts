import { TRACE } from '../constants';
import { ObservabilityService } from '../services/observability.service';
import { Logger } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';

/**
 * Decorador que añade trazabilidad a un método.
 * Crea automáticamente un span que abarca toda la ejecución del método,
 * captura errores y registra la duración.
 * 
 * @param name Nombre opcional del span (por defecto usa el nombre del método)
 * @param kind Tipo opcional del span (por defecto es INTERNAL)
 */
export function Trace(name?: string, kind: SpanKind = SpanKind.INTERNAL) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const spanName = name || `${className}.${methodName}`;
    
    // Crea un logger para este contexto
    const logger = new Logger(`${className}.${methodName}`);

    descriptor.value = function (...args: any[]) {
      try {
        // Intenta obtener el servicio de observabilidad del contexto
        const observabilityService: ObservabilityService = 
          this.observabilityService || 
          (this.moduleRef?.get(ObservabilityService, { strict: false }));

        // Si el servicio está disponible, usar tracing
        if (observabilityService) {
          return observabilityService.tracing.traceAsync(
            spanName,
            async (span) => {
              // Añadir atributos útiles al span
              span.setAttributes({
                [TRACE.SERVICE_NAME]: className,
                'code.function': methodName,
                'code.namespace': className,
              });

              try {
                // Ejecutar método original
                const result = await originalMethod.apply(this, args);
                
                // Si hay una propiedad 'id' en el resultado, añadirla como atributo
                if (result && typeof result === 'object' && 'id' in result) {
                  span.setAttribute('result.id', result.id);
                }
                
                return result;
              } catch (error) {
                // Marcar el span como error
                span.setStatus({
                  code: 2, // ERROR
                  message: error.message,
                });
                
                span.recordException(error);
                
                // También registrar el error en el logger
                logger.error(`Error in ${spanName}: ${error.message}`, error.stack);
                
                throw error;
              }
            },
            kind,
          );
        } else {
          // Si no hay servicio de observabilidad, simplemente ejecutar el método
          return originalMethod.apply(this, args);
        }
      } catch (error) {
        // Si algo falla en el decorador, solo loggearlo y seguir ejecutando el método original
        logger.error(`Error in Trace decorator: ${error.message}`, error.stack);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
} 