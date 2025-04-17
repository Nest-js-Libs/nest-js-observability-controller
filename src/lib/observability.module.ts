import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityService } from './services/observability.service';
import { TracingService } from './services/tracing.service';
import { LoggingService } from './services/logging.service';
import { MetricsService } from './services/metrics.service';
import { OBSERVABILITY_CONFIG_OPTIONS } from './constants';
import { ObservabilityModuleOptions } from './interfaces/observability-options.interface';
import { HttpTraceInterceptor } from './interceptors/http-trace.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Global()
@Module({})
export class ObservabilityModule {
  static register(options: ObservabilityModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: OBSERVABILITY_CONFIG_OPTIONS,
      useValue: options,
    };

    const httpInterceptorProvider = {
      provide: APP_INTERCEPTOR,
      useClass: HttpTraceInterceptor,
    };

    return {
      module: ObservabilityModule,
      imports: [ConfigModule],
      providers: [
        optionsProvider,
        ObservabilityService,
        TracingService,
        LoggingService,
        MetricsService,
        httpInterceptorProvider,
      ],
      exports: [
        ObservabilityService,
        TracingService,
        LoggingService,
        MetricsService,
      ],
    };
  }
}
