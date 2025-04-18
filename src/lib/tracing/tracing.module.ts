import { DynamicModule, Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import tracingConfig from './tracing.config';
import { TracingConfig } from './tracing.config';
import { TracingService } from './tracing.service';

@Global()
@Module({})
export class TracingModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  static forRoot(): DynamicModule {
    return {
      module: TracingModule,
      imports: [ConfigModule.forFeature(tracingConfig)],
      providers: [TracingService],
      exports: [TracingService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Partial<TracingConfig>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: TracingModule,
      imports: [ConfigModule.forFeature(tracingConfig)],
      providers: [
        {
          provide: 'TRACING_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        TracingService,
      ],
      exports: [TracingService],
    };
  }

  onModuleInit() {
    const config = this.configService.get<TracingConfig>('tracing');
    if (config?.enabled) {
      // La inicialización real se hace en el servicio
      // para asegurar que ocurra antes de que la aplicación comience
    }
  }
}
