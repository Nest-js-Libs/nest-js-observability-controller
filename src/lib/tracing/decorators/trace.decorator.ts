import { applyDecorators } from '@nestjs/common';
import { SpanOptions } from '../types';
import { SpanKind } from '@opentelemetry/api';

/**
 * Decorador para añadir trazabilidad a métodos en controladores y servicios.
 * Crea automáticamente un span para el método decorado.
 *
 * @param name Nombre personalizado para el span (opcional, por defecto usa el nombre del método)
 * @param options Opciones adicionales para el span
 */
export function Trace(name?: string, options?: SpanOptions) {
  return applyDecorators(
    // Este es un decorador de método
    (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      const spanName = name || `${target.constructor.name}.${propertyKey}`;
      const className = target.constructor.name;

      descriptor.value = function (...args: any[]) {
        // Necesitamos obtener el servicio de tracing del contenedor de DI de NestJS
        // Esto se hace en tiempo de ejecución para evitar dependencias circulares
        const tracingService = Reflect.getMetadata(
          'tracingService',
          target.constructor,
        );

        if (!tracingService) {
          console.warn(
            `TracingService no encontrado para ${spanName}. Asegúrate de usar @InjectTracing() en tu clase.`,
          );
          return originalMethod.apply(this, args);
        }

        // Preparar atributos base para el span
        const baseAttributes = {
          'code.function': propertyKey,
          'code.namespace': className,
          'code.filepath': target.constructor.name,
        };

        // Determinar el tipo de span basado en el contexto
        let spanKind = options?.kind || SpanKind.INTERNAL;

        // Si es un controlador, usar SERVER como tipo por defecto
        if (className.includes('Controller')) {
          spanKind = SpanKind.SERVER;
        }
        // Si es un servicio que hace llamadas externas, usar CLIENT como tipo
        else if (
          propertyKey.includes('fetch') ||
          propertyKey.includes('request') ||
          propertyKey.includes('call') ||
          propertyKey.includes('get')
        ) {
          spanKind = SpanKind.CLIENT;
        }

        // Combinar atributos base con los proporcionados por el usuario
        const combinedAttributes = {
          ...baseAttributes,
          ...options?.attributes,
        };

        // Ejecutar el método original dentro de un span
        return tracingService.trace(
          spanName,
          _span => originalMethod.apply(this, args),
          {
            attributes: combinedAttributes,
            kind: spanKind,
            // Opcionalmente, extraer atributos del resultado
            resultAttributes:
              options?.autoEnd !== false
                ? result => {
                    // Si el resultado es un objeto, intentar extraer información útil
                    if (result && typeof result === 'object') {
                      const resultAttrs: Record<string, any> = {};
                      // Añadir información sobre el tipo de resultado
                      resultAttrs['result.type'] = Array.isArray(result)
                        ? 'array'
                        : 'object';
                      // Añadir información sobre el tamaño si es un array
                      if (Array.isArray(result)) {
                        resultAttrs['result.length'] = result.length;
                      }
                      return resultAttrs;
                    }
                    return {};
                  }
                : undefined,
          },
        );
      };

      return descriptor;
    },
  );
}

/**
 * Decorador para inyectar el servicio de tracing en una clase.
 * Debe usarse en clases que utilicen el decorador @Trace.
 */
export function InjectTracing() {
  return (target: any) => {
    // Este decorador se ejecuta después de que NestJS haya creado la instancia
    // y configurado todas las dependencias
    const originalOnModuleInit = target.prototype.onModuleInit;

    target.prototype.onModuleInit = async function () {
      // Llamar al método original onModuleInit si existe
      if (originalOnModuleInit) {
        await originalOnModuleInit.apply(this);
      }

      // Almacenar el servicio de tracing en los metadatos de la clase
      if (this.tracingService) {
        Reflect.defineMetadata('tracingService', this.tracingService, target);
      }
    };
  };
}
