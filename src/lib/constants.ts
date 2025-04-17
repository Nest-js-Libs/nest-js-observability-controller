export const OBSERVABILITY_CONFIG_OPTIONS = 'OBSERVABILITY_CONFIG_OPTIONS';

// Constantes para métricas
export const METRICS = {
  HTTP_REQUEST_DURATION: 'http.request.duration',
  HTTP_REQUEST_TOTAL: 'http.request.total',
  HTTP_ERROR_TOTAL: 'http.error.total',
  HTTP_REQUEST_SIZE: 'http.request.size',
  HTTP_RESPONSE_SIZE: 'http.response.size',
  SYSTEM_CPU_USAGE: 'system.cpu.usage',
  SYSTEM_MEMORY_USAGE: 'system.memory.usage',
  SYSTEM_HEAP_USAGE: 'system.memory.heap.usage',
  SYSTEM_GC_DURATION: 'system.gc.duration',
};

// Constantes para trazas
export const TRACE = {
  SERVICE_NAME: 'service.name',
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  ERROR: 'error',
};

// Niveles de logs
export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
}; 