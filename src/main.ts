import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module';


import { UsersModule } from './users/users.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { StockModule } from './stock/stock.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WasteModule } from './waste/waste.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CsvMappingsModule } from './csv_mappings/csv_mappings.module';
import { ConfigService } from '@nestjs/config';
import { User } from './users/user.entity';
import { Request, Response } from 'express';

// Keep a cached instance of the application
let cachedServer: any;

async function bootstrap() {
  if (cachedServer) {
    return cachedServer;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  app.use(cookieParser());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Busy Fool API')
    .setDescription('Coffee Shop Management System')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    include: [
      AppModule,
      AuthModule,
      UsersModule,
      IngredientsModule,
      ProductsModule,
      SalesModule,
      PurchasesModule,
      StockModule,
      AnalyticsModule,
      WasteModule,
      DashboardModule,
      CsvMappingsModule,
    ],
    extraModels: [User],
  });

  // Serve the Swagger JSON specification
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api-json', (req: Request, res: Response) => {
    res.json(document);
  });

  // Serve the Swagger UI
  // Serve the static swagger.html file
  app.useStaticAssets(path.join(__dirname, '..', 'public'));

  // Enable CORS with specific configuration
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://busyfoolfrontend-six.vercel.app',
      'https://*.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  const configService = app.get(ConfigService);
  console.log(`DB_HOST: ${configService.get('DB_HOST')}`);
  console.log(`DB_PORT: ${configService.get('DB_PORT')}`);
  console.log(`DB_USER: ${configService.get('DB_USER')}`);
  console.log(`DB_NAME: ${configService.get('DB_NAME')}`);

  await app.init();

  console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV}`);
  // Only listen on a port if not in a Vercel environment
  if (!process.env.VERCEL_ENV) {
    console.log('Attempting to start local server...');
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  } else {
    console.log('Running in Vercel environment, not starting local server.');
  }

  cachedServer = app.getHttpAdapter().getInstance();
  return cachedServer;
}

export default async (req: Request, res: Response) => {
  const server = await bootstrap();
  server(req, res);
};
