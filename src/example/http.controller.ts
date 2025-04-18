import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectTracing, Trace } from 'src/lib/tracing/decorators';
import { TracingService } from 'src/lib/tracing/tracing.service';

/**
 * Controlador que demuestra el uso de tracing con llamadas HTTP a servicios externos
 */
@Controller('external')
@InjectTracing()
export class HttpTracingController {
  constructor(
    private readonly tracingService: TracingService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Obtiene datos de una API externa (simulada)
   */
  @Get('users')
  @Trace('external.getUsers', {
    attributes: { 'operation.type': 'http.client' },
  })
  async getExternalUsers(@Query('limit') limit = '10') {
    // El decorador @Trace creará automáticamente un span para este método
    const limitNumber = parseInt(limit, 10);

    try {
      // Simulamos una llamada a una API externa
      // En un caso real, esto sería una llamada a un servicio externo
      const response = await firstValueFrom(
        this.httpService.get(
          `https://jsonplaceholder.typicode.com/users?_limit=${limitNumber}`,
        ),
      );

      return response.data;
    } catch {
      // El error será capturado por el decorador @Trace y registrado en el span
      throw new HttpException(
        'Error al obtener usuarios externos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene detalles de un post específico de una API externa
   */
  @Get('posts/:id')
  async getExternalPost(@Param('id') id: string) {
    // Usando el servicio de tracing directamente para más control
    return this.tracingService.trace('external.getPost', async span => {
      span.setAttribute('post.id', id);
      span.setAttribute('operation.type', 'http.client');

      try {
        // Creamos un span hijo para la llamada HTTP específica
        const postResponse = await this.tracingService.trace(
          'http.request.post',
          async childSpan => {
            childSpan.setAttribute(
              'http.url',
              `https://jsonplaceholder.typicode.com/posts/${id}`,
            );
            childSpan.setAttribute('http.method', 'GET');

            const response = await firstValueFrom(
              this.httpService.get(
                `https://jsonplaceholder.typicode.com/posts/${id}`,
              ),
            );

            childSpan.setAttribute('http.status_code', response.status);
            return response.data;
          },
        );

        // Creamos otro span hijo para obtener los comentarios del post
        const commentsResponse = await this.tracingService.trace(
          'http.request.comments',
          async childSpan => {
            childSpan.setAttribute(
              'http.url',
              `https://jsonplaceholder.typicode.com/posts/${id}/comments`,
            );
            childSpan.setAttribute('http.method', 'GET');

            const response = await firstValueFrom(
              this.httpService.get(
                `https://jsonplaceholder.typicode.com/posts/${id}/comments`,
              ),
            );

            childSpan.setAttribute('http.status_code', response.status);
            childSpan.setAttribute('comments.count', response.data.length);
            return response.data;
          },
        );

        // Combinamos los resultados
        return {
          post: postResponse,
          comments: commentsResponse,
        };
      } catch (error) {
        // Registramos el error en el span
        span.setAttribute('error', true);
        span.setAttribute('error.message', error.message);

        throw new HttpException(
          `Error al obtener el post ${id}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  }

  /**
   * Simula una llamada a múltiples servicios en paralelo
   */
  @Get('dashboard')
  @Trace('external.getDashboardData')
  async getDashboardData() {
    try {
      // Realizamos múltiples llamadas en paralelo y rastreamos cada una
      const [users, posts, todos] = await Promise.all([
        this.tracingService.trace('dashboard.getUsers', async span => {
          span.setAttribute(
            'http.url',
            'https://jsonplaceholder.typicode.com/users?_limit=5',
          );

          const response = await firstValueFrom(
            this.httpService.get(
              'https://jsonplaceholder.typicode.com/users?_limit=5',
            ),
          );

          return response.data;
        }),

        this.tracingService.trace('dashboard.getPosts', async span => {
          span.setAttribute(
            'http.url',
            'https://jsonplaceholder.typicode.com/posts?_limit=5',
          );

          const response = await firstValueFrom(
            this.httpService.get(
              'https://jsonplaceholder.typicode.com/posts?_limit=5',
            ),
          );

          return response.data;
        }),

        this.tracingService.trace('dashboard.getTodos', async span => {
          span.setAttribute(
            'http.url',
            'https://jsonplaceholder.typicode.com/todos?_limit=5',
          );

          const response = await firstValueFrom(
            this.httpService.get(
              'https://jsonplaceholder.typicode.com/todos?_limit=5',
            ),
          );

          return response.data;
        }),
      ]);

      return {
        users,
        posts,
        todos,
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new HttpException(
        'Error al obtener datos del dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
