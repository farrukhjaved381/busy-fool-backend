import { DataSource } from 'typeorm';

console.log('Loading data-source.ts - Verified');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5433),
  username: process.env.DB_USER || 'busyfool',
  password: process.env.DB_PASSWORD || 'securepassword',
  database: process.env.DB_NAME || 'busyfool_dev',
  synchronize: true,
  logging: true,
  entities: ['dist/**/*.entity.js'], // Use compiled output
  migrations: ['dist/migrations/*.js'],
});