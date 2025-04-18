import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TracingExamplesModule } from './example/tracing-examples.module';

export const swaggerConfig = app => {
  const options = new DocumentBuilder()
    .setTitle('OBSERVABILITY EXAMPLE')
    .setDescription('The OBSERVABILITY EXAMPLE API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);
};


async function bootstrap() {
  const app = await NestFactory.create(TracingExamplesModule);
  swaggerConfig(app);
  await app.listen(8080);
  console.log('Application is running on: http://localhost:8080');
}
bootstrap();