import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as multer from 'multer';
import * as fs from 'fs';
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


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Busy Fool API')
    .setDescription('Coffee Shop Management System')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
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
  });
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Configure Multer for file uploads
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });

  // Serve static files from uploads directory
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // Enable CORS
  app.enableCors();

  const configService = app.get(ConfigService);
  console.log(`DB_HOST: ${configService.get('DB_HOST')}`);
  console.log(`DB_PORT: ${configService.get('DB_PORT')}`);
  console.log(`DB_USER: ${configService.get('DB_USER')}`);
  console.log(`DB_NAME: ${configService.get('DB_NAME')}`);

  await app.listen(3006);
  console.log(`Application is running on: http://localhost:3006`);
  console.log(`Swagger UI is available at: http://localhost:3006/api`);
}
bootstrap();