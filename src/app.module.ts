import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { PassportModule } from '@nestjs/passport';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { User } from './users/user.entity';
import { Ingredient } from './ingredients/entities/ingredient.entity';
import { Product } from './products/entities/product.entity';
import { ProductIngredient } from './products/entities/product-ingredient.entity';
import { Sale } from './sales/entities/sale.entity';
import { Stock } from './stock/entities/stock.entity';
import { StockModule } from './stock/stock.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WasteModule } from './waste/waste.module';
import { Waste } from './waste/entities/waste.entity';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        ssl: {
          rejectUnauthorized: false, // required for Neon
        },
        entities: ['dist/**/*.entity.js'],
        synchronize: false,
        logging: true,
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    IngredientsModule,
    ProductsModule,
    SalesModule,
    PurchasesModule,
    AnalyticsModule,
    StockModule,
    WasteModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}