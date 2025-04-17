import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { ObservabilityService } from '../services/observability.service';
import { Request, Response } from 'express';
import { TRACE } from '../constants';
import { SpanKind } from '@opentelemetry/api';

@Injectable()
export class HttpTraceInterceptor implements NestInterceptor {
  constructor(private readonly observabilityService: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const { method, url, headers, body, params, query } = request;
    
    // Atributos estándar para trazas y métricas
    const attributes = {
      [TRACE.HTTP_METHOD]: method,
      [TRACE.HTTP_URL]: url,
      'http.host': headers.host,
      'http.user_agent': headers['user-agent'],
      'http.route': request.route?.path || url,
    };

    // Primero generamos una Promise que se resolverá en un Observable
    // Luego usamos from() para convertir esa Promise en un Observable
    // Y finalmente usamos switchMap para "aplanar" y trabajar con el Observable resultante
    return from(
      this.observabilityService.tracing.traceAsync(
        `HTTP ${method} ${url}`,
        async (span) => {
          // Añade atributos al span
          span.setAttributes(attributes);
          
          // Registra detalles de la solicitud para depuración
          this.observabilityService.logs.debug(
            `Incoming request: ${method} ${url}`,
            'HttpInterceptor',
            { params, query, headers }
          );

          // Incrementa el contador de solicitudes HTTP
          this.observabilityService.metrics.incrementHttpRequestTotal(attributes);
          
          // Registra el tamaño de la solicitud
          if (body && Object.keys(body).length > 0) {
            const requestSize = JSON.stringify(body).length;
            this.observabilityService.metrics.recordHttpRequestSize(requestSize, attributes);
          }

          // Devolvemos el Observable directamente, no la Promise
          return next.handle();
        },
        SpanKind.SERVER
      )
    ).pipe(
      // Usamos switchMap para pasar del Observable externo (from) al Observable de la operación
      switchMap(observable => observable.pipe(
        tap((data) => {
          const response = httpContext.getResponse<Response>();
          const statusCode = response.statusCode;
          const duration = Date.now() - start;
          
          // Actualiza los atributos con información de respuesta
          const responseAttributes = {
            ...attributes,
            [TRACE.HTTP_STATUS_CODE]: statusCode,
            'http.duration_ms': duration,
          };
          
          // Actualiza atributos del span
          const span = this.observabilityService.tracing.getCurrentSpan();
          if (span) span.setAttributes(responseAttributes);
          
          // Registra la duración de la solicitud
          this.observabilityService.metrics.recordHttpRequestDuration(
            duration,
            responseAttributes
          );
          
          // Registra el tamaño de la respuesta
          if (data) {
            const responseSize = JSON.stringify(data).length;
            this.observabilityService.metrics.recordHttpResponseSize(
              responseSize,
              responseAttributes
            );
          }
          
          // Log la respuesta exitosa
          this.observabilityService.logs.info(
            `Request completed: ${method} ${url} ${statusCode} ${duration}ms`,
            'HttpInterceptor',
            responseAttributes
          );
        }),
        catchError((error) => {
          const response = httpContext.getResponse<Response>();
          const statusCode = response.statusCode || 500;
          const duration = Date.now() - start;
          
          // Atributos para error
          const errorAttributes = {
            ...attributes,
            [TRACE.HTTP_STATUS_CODE]: statusCode,
            [TRACE.ERROR]: true,
            'error.name': error.name,
            'error.message': error.message,
            'http.duration_ms': duration,
          };
          
          // Registra el error en métricas
          this.observabilityService.metrics.incrementHttpErrorTotal(errorAttributes);
          
          // Registra duración incluso para solicitudes fallidas
          this.observabilityService.metrics.recordHttpRequestDuration(
            duration,
            errorAttributes
          );
          
          // Marca el span como error
          this.observabilityService.tracing.setError(error);
          
          // Log el error
          this.observabilityService.logs.error(
            `Request failed: ${method} ${url} ${statusCode}`,
            error.stack,
            'HttpInterceptor',
            errorAttributes
          );
          
          return throwError(() => error);
        })
      ))
    );
  }
} 