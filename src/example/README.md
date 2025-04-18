# Controladores de Ejemplo para Tracing

Este directorio contiene controladores de ejemplo que demuestran diferentes casos de uso del módulo de tracing en una aplicación NestJS.

## Controladores Disponibles

### 1. BasicTracingController

Un controlador básico que demuestra operaciones CRUD simples con tracing:

- `GET /api/products`: Obtiene todos los productos con paginación opcional
- `GET /api/products/:id`: Obtiene un producto por su ID
- `POST /api/products`: Crea un nuevo producto
- `PUT /api/products/:id`: Actualiza un producto existente
- `DELETE /api/products/:id`: Elimina un producto

### 2. HttpTracingController

Demuestra el uso de tracing con llamadas HTTP a servicios externos:

- `GET /api/external/users`: Obtiene usuarios de una API externa
- `GET /api/external/posts/:id`: Obtiene un post específico con sus comentarios
- `GET /api/external/dashboard`: Obtiene datos de múltiples servicios en paralelo

### 3. DatabaseTracingController

Demuestra el uso de tracing con operaciones de base de datos (simuladas):

- `GET /api/users`: Obtiene todos los usuarios con filtros opcionales
- `GET /api/users/:id`: Obtiene un usuario por su ID
- `POST /api/users`: Crea un nuevo usuario
- `PUT /api/users/:id`: Actualiza un usuario existente
- `DELETE /api/users/:id`: Elimina un usuario
- `GET /api/users/search/advanced`: Realiza una búsqueda avanzada

### 4. AsyncTracingController

Demuestra el uso de tracing con operaciones asíncronas y tareas en segundo plano:

- `GET /api/tasks`: Obtiene todas las tareas con filtro opcional por estado
- `POST /api/tasks`: Crea una nueva tarea asíncrona
- `GET /api/tasks/:id`: Obtiene el estado actual de una tarea
- `POST /api/tasks/batch`: Procesa un lote de elementos
- `GET /api/tasks/stream`: Simula una operación de streaming

## Cómo Usar

Para utilizar estos controladores de ejemplo, importa el módulo `TracingExamplesModule` en tu módulo principal:

```typescript
import { Module } from '@nestjs/common';
import { TracingModule, TracingExamplesModule } from './app/tracing';

@Module({
  imports: [
    TracingModule.forRoot(),
    TracingExamplesModule,
    // Otros módulos...
  ],
})
export class AppModule {}
```

## Visualización con Grafana

Los ejemplos están configurados para enviar trazas a Jaeger, que puede ser visualizado directamente o a través de Grafana. El archivo `docker-compose.yml` incluye la configuración necesaria para ejecutar Jaeger, Prometheus, Loki y Grafana.

Para acceder a las interfaces de usuario:

- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (usuario: admin, contraseña: admin)

En Grafana, puedes configurar fuentes de datos para Jaeger, Prometheus y Loki para visualizar trazas, métricas y logs en un solo lugar.