import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { InjectTracing, Trace } from 'src/lib/tracing/decorators';
import { TracingService } from 'src/lib/tracing/tracing.service';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

/**
 * Controlador básico que demuestra el uso de tracing en operaciones CRUD simples
 */
@Controller('/basic/products')
@InjectTracing()
export class BasicTracingController {
  // Simulación de base de datos en memoria
  private products: Product[] = [
    {
      id: '1',
      name: 'Producto 1',
      price: 100,
      description: 'Descripción del producto 1',
    },
    {
      id: '2',
      name: 'Producto 2',
      price: 200,
      description: 'Descripción del producto 2',
    },
  ];

  constructor(private readonly tracingService: TracingService) {}

  /**
   * Obtiene todos los productos con paginación opcional
   */
  @Get()
  @Trace('products.findAll')
  findAll(@Query('limit') limit = '10') {
    // El decorador @Trace creará automáticamente un span para este método
    const limitNumber = parseInt(limit, 10);

    // Simulamos un pequeño retraso para ver mejor el span en las herramientas de tracing
    return new Promise<Product[]>(resolve => {
      setTimeout(() => {
        resolve(this.products.slice(0, limitNumber));
      }, 50);
    });
  }

  /**
   * Obtiene un producto por su ID
   */
  @Get(':id')
  @Trace('products.findById', { attributes: { 'operation.type': 'read' } })
  findById(@Param('id') id: string) {
    // Usando el decorador @Trace con atributos personalizados
    return new Promise<Product>((resolve, reject) => {
      setTimeout(() => {
        const product = this.products.find(p => p.id === id);
        if (!product) {
          reject(new Error(`Producto con ID ${id} no encontrado`));
          return;
        }
        resolve(product);
      }, 30);
    });
  }

  /**
   * Crea un nuevo producto
   */
  @Post()
  create(@Body() productData: Omit<Product, 'id'>) {
    // Usando el servicio de tracing directamente para más control
    return this.tracingService.trace('products.create', async span => {
      // Añadir atributos personalizados al span
      span.setAttribute('product.name', productData.name);
      span.setAttribute('product.price', productData.price);

      // Simulamos la creación del producto
      await new Promise(resolve => setTimeout(resolve, 100));

      const newProduct: Product = {
        id: (this.products.length + 1).toString(),
        ...productData,
      };

      this.products.push(newProduct);
      return newProduct;
    });
  }

  /**
   * Actualiza un producto existente
   */
  @Put(':id')
  @Trace('products.update')
  update(@Param('id') id: string, @Body() productData: Partial<Product>) {
    return this.tracingService.trace(
      'products.update.implementation',
      async span => {
        span.setAttribute('product.id', id);

        // Simulamos la actualización
        await new Promise(resolve => setTimeout(resolve, 75));

        const index = this.products.findIndex(p => p.id === id);
        if (index === -1) {
          throw new Error(`Producto con ID ${id} no encontrado`);
        }

        this.products[index] = { ...this.products[index], ...productData };
        return this.products[index];
      },
    );
  }

  /**
   * Elimina un producto
   */
  @Delete(':id')
  @Trace('products.delete')
  delete(@Param('id') id: string) {
    return new Promise<{ success: boolean }>((resolve, reject) => {
      setTimeout(() => {
        const index = this.products.findIndex(p => p.id === id);
        if (index === -1) {
          reject(new Error(`Producto con ID ${id} no encontrado`));
          return;
        }

        this.products.splice(index, 1);
        resolve({ success: true });
      }, 50);
    });
  }
}
