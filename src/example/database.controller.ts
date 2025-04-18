import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectTracing, Trace } from 'src/lib/tracing/decorators';
import { TracingService } from 'src/lib/tracing/tracing.service';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

/**
 * Controlador que demuestra el uso de tracing con operaciones de base de datos
 * (simuladas para este ejemplo)
 */
@Controller('users')
@InjectTracing()
export class DatabaseTracingController {
  // Simulación de base de datos en memoria
  private users: User[] = [
    {
      id: '1',
      name: 'Usuario 1',
      email: 'usuario1@example.com',
      role: 'admin',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
    },
    {
      id: '2',
      name: 'Usuario 2',
      email: 'usuario2@example.com',
      role: 'user',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 días atrás
    },
  ];

  constructor(private readonly tracingService: TracingService) {}

  /**
   * Obtiene todos los usuarios con filtros opcionales
   */
  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('sort') sort = 'createdAt',
    @Query('order') order = 'desc',
  ) {
    return this.tracingService.trace('database.users.findAll', async span => {
      // Añadimos atributos al span para registrar los parámetros de la consulta
      span.setAttribute('db.operation', 'SELECT');
      span.setAttribute('db.filter.role', role || 'all');
      span.setAttribute('db.sort', sort);
      span.setAttribute('db.order', order);

      // Simulamos una consulta a la base de datos
      await new Promise(resolve => setTimeout(resolve, 100));

      // Filtramos los usuarios según los parámetros
      let result = [...this.users];

      if (role) {
        result = result.filter(user => user.role === role);
      }

      // Ordenamos los resultados
      result.sort((a, b) => {
        const aValue = a[sort];
        const bValue = b[sort];

        if (order === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Registramos la cantidad de resultados
      span.setAttribute('db.result.count', result.length);

      return result;
    });
  }

  /**
   * Obtiene un usuario por su ID
   */
  @Get(':id')
  @Trace('database.users.findById', {
    attributes: { 'db.operation': 'SELECT' },
  })
  async findById(@Param('id') id: string) {
    // Simulamos una consulta a la base de datos
    await new Promise(resolve => setTimeout(resolve, 50));

    const user = this.users.find(u => u.id === id);

    if (!user) {
      throw new HttpException(
        `Usuario con ID ${id} no encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  /**
   * Crea un nuevo usuario
   */
  @Post()
  async create(@Body() userData: Omit<User, 'id' | 'createdAt'>) {
    return this.tracingService.trace('database.users.create', async span => {
      span.setAttribute('db.operation', 'INSERT');
      span.setAttribute('user.email', userData.email);

      // Verificamos si ya existe un usuario con el mismo email
      const existingUser = this.users.find(u => u.email === userData.email);

      if (existingUser) {
        span.setAttribute('error', true);
        span.setAttribute('error.type', 'duplicate_email');
        throw new HttpException(
          'Ya existe un usuario con ese email',
          HttpStatus.CONFLICT,
        );
      }

      // Simulamos una operación de inserción en la base de datos
      await new Promise(resolve => setTimeout(resolve, 150));

      // Creamos el nuevo usuario
      const newUser: User = {
        id: (this.users.length + 1).toString(),
        ...userData,
        createdAt: new Date(),
      };

      // Simulamos una transacción
      await this.tracingService.trace(
        'database.transaction',
        async childSpan => {
          childSpan.setAttribute('db.operation', 'TRANSACTION');

          // Simulamos la inserción
          await new Promise(resolve => setTimeout(resolve, 50));
          this.users.push(newUser);

          // Simulamos una actualización de índices
          await this.tracingService.trace(
            'database.index.update',
            async indexSpan => {
              indexSpan.setAttribute('db.operation', 'INDEX');
              await new Promise(resolve => setTimeout(resolve, 30));
            },
          );
        },
      );

      return newUser;
    });
  }

  /**
   * Actualiza un usuario existente
   */
  @Put(':id')
  @Trace('database.users.update')
  async update(@Param('id') id: string, @Body() userData: Partial<User>) {
    // Simulamos una operación de actualización en la base de datos
    await new Promise(resolve => setTimeout(resolve, 120));

    const index = this.users.findIndex(u => u.id === id);

    if (index === -1) {
      throw new HttpException(
        `Usuario con ID ${id} no encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Actualizamos el usuario
    this.users[index] = { ...this.users[index], ...userData };

    return this.users[index];
  }

  /**
   * Elimina un usuario
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.tracingService.trace('database.users.delete', async span => {
      span.setAttribute('db.operation', 'DELETE');
      span.setAttribute('user.id', id);

      // Simulamos una operación de eliminación en la base de datos
      await new Promise(resolve => setTimeout(resolve, 80));

      const index = this.users.findIndex(u => u.id === id);

      if (index === -1) {
        span.setAttribute('error', true);
        span.setAttribute('error.type', 'not_found');
        throw new HttpException(
          `Usuario con ID ${id} no encontrado`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Eliminamos el usuario
      this.users.splice(index, 1);

      return {
        success: true,
        message: `Usuario con ID ${id} eliminado correctamente`,
      };
    });
  }

  /**
   * Realiza una búsqueda compleja (simulada)
   */
  @Get('search/advanced')
  async advancedSearch(
    @Query('term') term: string,
    @Query('fields') fields = 'name,email',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tracingService.trace(
      'database.users.advancedSearch',
      async span => {
        span.setAttribute('db.operation', 'SEARCH');
        span.setAttribute('search.term', term || '');
        span.setAttribute('search.fields', fields);

        if (from) span.setAttribute('search.from', from);
        if (to) span.setAttribute('search.to', to);

        // Simulamos una búsqueda compleja
        await new Promise(resolve => setTimeout(resolve, 200));

        const fieldList = fields.split(',');
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;

        // Filtramos los usuarios según los criterios de búsqueda
        const results = this.users.filter(user => {
          // Filtro por término de búsqueda en los campos especificados
          const matchesTerm =
            !term ||
            fieldList.some(field => {
              return user[field]
                ?.toString()
                .toLowerCase()
                .includes(term.toLowerCase());
            });

          // Filtro por rango de fechas
          const matchesDateRange =
            (!fromDate || user.createdAt >= fromDate) &&
            (!toDate || user.createdAt <= toDate);

          return matchesTerm && matchesDateRange;
        });

        span.setAttribute('search.results.count', results.length);

        return {
          results,
          metadata: {
            total: results.length,
            term,
            fields: fieldList,
            dateRange: { from, to },
          },
        };
      },
    );
  }
}
