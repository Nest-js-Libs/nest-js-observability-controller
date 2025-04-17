export interface MetricsOptions {
  enabled?: boolean;
  prefix?: string;
  defaultLabels?: Record<string, string>;
  prometheusEndpoint?: string;
  port?: number;
}

export interface TracingOptions {
  enabled?: boolean;
  serviceName?: string;
  exporters?: {
    jaeger?: {
      enabled?: boolean;
      endpoint?: string;
    };
    otlp?: {
      enabled?: boolean;
      endpoint?: string;
    };
  };
  sampling?: {
    enabled?: boolean;
    ratio?: number;
  };
  instrumentations?: {
    http?: boolean;
    grpc?: boolean;
    express?: boolean;
    nestjs?: boolean;
    graphql?: boolean;
    redis?: boolean;
    mongodb?: boolean;
    mysql?: boolean;
    postgres?: boolean;
  };
}

export interface LoggingOptions {
  enabled?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format?: 'json' | 'text';
  exporters?: {
    loki?: {
      enabled?: boolean;
      endpoint?: string;
    };
    promtail?: {
      enabled?: boolean;
      endpoint?: string;
    };
    console?: boolean;
    file?: {
      enabled?: boolean;
      path?: string;
    };
  };
  includeTraceContext?: boolean;
}

export interface ObservabilityModuleOptions {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  metrics?: MetricsOptions;
  tracing?: TracingOptions;
  logging?: LoggingOptions;
} 