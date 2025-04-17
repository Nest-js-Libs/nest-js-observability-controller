import { Controller, Get } from '@nestjs/common';
import { ObservabilityService } from '../lib/services/observability.service';

@Controller()
export class ExampleController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get()
  getHello() {
    this.observabilityService.recordEvent('app.visited', { page: 'home' }, 'Usuario visitó la página principal');
    return { message: 'Hello World!' };
  }
}