import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectTracing, Trace } from 'src/lib/tracing/decorators';
import { TracingService } from 'src/lib/tracing/tracing.service';

interface Task {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Controlador que demuestra el uso de tracing con operaciones asíncronas
 * y tareas en segundo plano
 */
@Controller('tasks')
@InjectTracing()
export class AsyncTracingController {
  // Simulación de tareas en memoria
  private tasks: Task[] = [];
  private taskCounter = 0;

  constructor(private readonly tracingService: TracingService) {}

  /**
   * Obtiene todas las tareas con filtro opcional por estado
   */
  @Get()
  @Trace('tasks.findAll')
  async findAll(
    @Query('status') status?: 'pending' | 'processing' | 'completed' | 'failed',
  ) {
    // Simulamos una pequeña latencia
    await new Promise(resolve => setTimeout(resolve, 50));

    // Filtramos las tareas por estado si se proporciona
    if (status) {
      return this.tasks.filter(task => task.status === status);
    }

    return this.tasks;
  }

  /**
   * Crea una nueva tarea asíncrona y la procesa en segundo plano
   */
  @Post()
  async createTask(@Body() taskData: { name: string; duration?: number }) {
    return this.tracingService.trace('tasks.create', async span => {
      span.setAttribute('task.name', taskData.name);

      // Creamos la nueva tarea
      const taskId = (++this.taskCounter).toString();
      const now = new Date();

      const newTask: Task = {
        id: taskId,
        name: taskData.name,
        status: 'pending',
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };

      this.tasks.push(newTask);

      // Iniciamos el procesamiento asíncrono de la tarea
      this.processTaskAsync(taskId, taskData.duration || 5000);

      return {
        message: 'Tarea creada y procesando en segundo plano',
        task: newTask,
      };
    });
  }

  /**
   * Obtiene el estado actual de una tarea específica
   */
  @Get(':id')
  @Trace('tasks.findById')
  async getTaskStatus(@Query('id') id: string) {
    const task = this.tasks.find(t => t.id === id);

    if (!task) {
      throw new HttpException(
        `Tarea con ID ${id} no encontrada`,
        HttpStatus.NOT_FOUND,
      );
    }

    return task;
  }

  /**
   * Simula el procesamiento asíncrono de una tarea en segundo plano
   * con actualización de progreso y tracing
   */
  private async processTaskAsync(taskId: string, duration: number) {
    // Creamos un nuevo span para el procesamiento asíncrono
    // Nota: En un caso real, este span debería estar vinculado al span padre
    // a través de un contexto de propagación
    this.tracingService.trace('tasks.process', async span => {
      span.setAttribute('task.id', taskId);
      span.setAttribute('task.duration', duration);

      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      // Actualizamos el estado a 'processing'
      task.status = 'processing';
      task.updatedAt = new Date();

      try {
        // Simulamos el procesamiento con actualizaciones de progreso
        const steps = 10;
        const stepDuration = duration / steps;

        for (let i = 1; i <= steps; i++) {
          await new Promise(resolve => setTimeout(resolve, stepDuration));

          // Actualizamos el progreso
          task.progress = (i / steps) * 100;
          task.updatedAt = new Date();

          // Creamos un span hijo para cada paso del proceso
          await this.tracingService.trace(
            'tasks.process.step',
            async childSpan => {
              childSpan.setAttribute('task.id', taskId);
              childSpan.setAttribute('task.step', i);
              childSpan.setAttribute('task.progress', task.progress);

              // Simulamos algún procesamiento en este paso
              await new Promise(resolve => setTimeout(resolve, 50));
            },
          );

          // Simulamos un error aleatorio en el paso 7 (solo para demostración)
          if (i === 7 && Math.random() < 0.3) {
            throw new Error(
              'Error aleatorio durante el procesamiento de la tarea',
            );
          }
        }

        // Tarea completada exitosamente
        task.status = 'completed';
        task.progress = 100;
        task.result = {
          message: 'Tarea completada exitosamente',
          processingTime: duration,
          completedAt: new Date(),
        };
      } catch (error) {
        // Registramos el error en el span
        span.setAttribute('error', true);
        span.setAttribute('error.message', error.message);

        // Actualizamos el estado de la tarea a 'failed'
        task.status = 'failed';
        task.error = error.message;
      } finally {
        // Actualizamos la fecha de modificación
        task.updatedAt = new Date();
      }
    });
  }

  /**
   * Simula una operación de procesamiento por lotes con tracing
   */
  @Post('batch')
  async processBatch(
    @Body() batchData?: { items: string[]; processEach?: boolean },
  ) {
    return this.tracingService.trace('tasks.processBatch', async span => {
      // Verificar si batchData existe y proporcionar valores predeterminados
      const { items = [], processEach = false } = batchData || {};

      span.setAttribute('batch.items.count', items.length);
      span.setAttribute('batch.processEach', processEach);

      // Simulamos un procesamiento por lotes
      if (processEach) {
        // Procesamiento secuencial de cada elemento
        const results: any[] = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // Creamos un span hijo para cada elemento
          const result = await this.tracingService.trace(
            'tasks.processBatch.item',
            async childSpan => {
              childSpan.setAttribute('item.index', i);
              childSpan.setAttribute('item.value', item);

              // Simulamos el procesamiento del elemento
              await new Promise(resolve => setTimeout(resolve, 100));

              return {
                item,
                processed: true,
                index: i,
              };
            },
          );

          results.push(result);
        }

        return {
          batchComplete: true,
          processedCount: results.length,
          results,
        };
      } else {
        // Procesamiento en paralelo (simulado)
        await new Promise(resolve => setTimeout(resolve, 300));

        return {
          batchComplete: true,
          processedCount: items.length,
          processingType: 'parallel',
        };
      }
    });
  }

  /**
   * Simula una operación de streaming con tracing
   */
  @Get('stream')
  async streamData(
    @Query('duration') duration = '2000',
    @Query('chunks') chunks = '5',
  ) {
    return this.tracingService.trace('tasks.streamData', async span => {
      const durationMs = parseInt(duration, 10);
      const chunksCount = parseInt(chunks, 10);

      span.setAttribute('stream.duration', durationMs);
      span.setAttribute('stream.chunks', chunksCount);

      // Simulamos un streaming de datos
      const results: any[] = [];
      const chunkDuration = durationMs / chunksCount;

      for (let i = 0; i < chunksCount; i++) {
        // Creamos un span hijo para cada chunk
        const chunkResult = await this.tracingService.trace(
          'tasks.streamData.chunk',
          async childSpan => {
            childSpan.setAttribute('chunk.index', i);

            // Simulamos el procesamiento del chunk
            await new Promise(resolve => setTimeout(resolve, chunkDuration));

            const data = {
              chunkId: i,
              timestamp: new Date().toISOString(),
              data: `Datos del chunk ${i}`,
              size: Math.floor(Math.random() * 1000) + 500,
            };

            childSpan.setAttribute('chunk.size', data.size);

            return data;
          },
        );

        results.push(chunkResult);
      }

      return {
        streamComplete: true,
        chunks: results,
        totalSize: results.reduce((sum, chunk) => sum + chunk.size, 0),
      };
    });
  }
}
