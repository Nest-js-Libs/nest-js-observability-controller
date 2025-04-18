import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TracingService } from '../tracing.service';
import { Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly tracingService: TracingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, route, body, params, query, headers } = request;
    const routePath = route?.path || url;
    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;
    
    // Crear un span para la solicitud HTTP utilizando atributos semánticos estándar
    const span = this.tracingService.createSpan(`HTTP ${method} ${routePath}`, {
      // Atributos semánticos estándar de OpenTelemetry
      [SemanticAttributes.HTTP_METHOD]: method,
      [SemanticAttributes.HTTP_URL]: url,
      [SemanticAttributes.HTTP_ROUTE]: routePath,
      [SemanticAttributes.HTTP_USER_AGENT]: headers['user-agent'] || '',
      [SemanticAttributes.HTTP_CLIENT_IP]: request.ip || '',
      
      // Atributos personalizados para NestJS
      'nestjs.controller': controllerName,
      'nestjs.handler': handlerName,
    }, {
      kind: SpanKind.SERVER, // Marcar como span de servidor
    });
    
    // Añadir información adicional al span si está disponible
    this.addRequestMetadata(span, body, params, query);
    
    // Continuar con el manejo de la solicitud y finalizar el span cuando termine
    return next.handle().pipe(
      tap({
        next: (data) => {
          // Solicitud exitosa - añadir código de estado HTTP
          const statusCode = response.statusCode;
          this.tracingService.endSpan(span, true, undefined, {
            [SemanticAttributes.HTTP_STATUS_CODE]: statusCode,
            'response.size': this.getApproximateResponseSize(data),
          });
        },
        error: (error) => {
          // Error en la solicitud - añadir código de estado HTTP y detalles del error
          const statusCode = error.status || 500;
          this.tracingService.endSpan(span, false, error, {
            [SemanticAttributes.HTTP_STATUS_CODE]: statusCode,
            'error.name': error.name || 'Error',
            'error.code': error.code || 'UNKNOWN',
          });
        },
      }),
    );
  }

  private addRequestMetadata(span: Span, body?: any, params?: any, query?: any): void {
    if (!span) return;
    
    // Añadir parámetros de ruta si existen (evitando datos sensibles)
    if (params && Object.keys(params).length > 0) {
      // Filtrar datos sensibles como contraseñas, tokens, etc.
      const safeParams = this.sanitizeData(params);
      span.setAttribute('request.params', JSON.stringify(safeParams));
    }
    
    // Añadir parámetros de consulta si existen
    if (query && Object.keys(query).length > 0) {
      const safeQuery = this.sanitizeData(query);
      span.setAttribute('request.query', JSON.stringify(safeQuery));
    }
    
    // Añadir cuerpo de la solicitud si existe (con precaución para evitar datos sensibles)
    if (body && Object.keys(body).length > 0) {
      const safeBody = this.sanitizeData(body);
      span.setAttribute('request.body', JSON.stringify(safeBody));
    }
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    // Clonar el objeto para no modificar el original
    const sanitized = { ...data };
    
    // Lista de campos sensibles que deben ser redactados
    const sensitiveFields = [
      'password', 'token', 'secret', 'authorization', 'key', 'apiKey', 'api_key',
      'credential', 'credentials', 'accessToken', 'refreshToken', 'auth',
      'jwt', 'session', 'cookie', 'csrf', 'ssn', 'cc', 'card', 'cvv', 'pin'
    ];
    
    // Redactar campos sensibles
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        // Recursivamente sanitizar objetos anidados
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });
    
    return sanitized;
  }
  
  /**
   * Calcula el tamaño aproximado de la respuesta en bytes
   * Útil para análisis de rendimiento
   */
  private getApproximateResponseSize(data: any): number {
    if (data === null || data === undefined) {
      return 0;
    }
    
    try {
      if (typeof data === 'string') {
        return data.length;
      }
      
      if (typeof data === 'object') {
        // Convertir a JSON y medir el tamaño
        const json = JSON.stringify(data);
        return json.length;
      }
      
      // Para otros tipos, convertir a string
      return String(data).length;
    } catch (error) {
      // En caso de error, devolver -1 para indicar que no se pudo calcular
      return -1;
    }
  }
}