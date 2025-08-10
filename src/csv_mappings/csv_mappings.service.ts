import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsvMappings } from './entities/csv-mappings.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';
import * as fs from 'fs';
import * as csvParser from 'fast-csv';
import * as XLSX from 'xlsx';

interface Insight {
  totalSales: number;
  totalProfit: number;
  avgProfitMargin: number;
  rows: {
    productName: string;
    quantitySold: number;
    salePrice: number; // Total amount for the row
    unitPrice: number; // Calculated unit price
    saleDate: Date | null;
    profit: number;
  }[];
}

interface DailySales {
  date: string;
  totalSales: number;
  totalProfit: number;
  itemsSold: number;
}

@Injectable()
export class CsvMappingsService {
  private readonly logger = new Logger(CsvMappingsService.name);

  constructor(
    @InjectRepository(CsvMappings)
    private csvMappingRepository: Repository<CsvMappings>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getCsvHeaders(filePath: string): Promise<string[]> {
    const fileExt = filePath.split('.').pop()?.toLowerCase();
  
    if (fileExt === 'csv') {
      return new Promise((resolve, reject) => {
        csvParser
          .parseFile(filePath, { headers: true })
          .on('headers', (hdrs: string[]) => {
            resolve(hdrs.map((h: string) => h.trim()));
          })
          .on('error', reject);
      });
    } 
    else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // first sheet
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      if (!rows.length) throw new BadRequestException('No data found in Excel file.');
      const headers = rows[0].map((h: string) => h.trim());
      return headers;
    } 
    else {
      throw new BadRequestException('Unsupported file format. Please upload .csv or .xlsx');
    }
  }
  

  async saveMapping(
    userId: string,
    mappings: { busyfoolColumn: string; posColumnName: string }[],
  ) {
    await this.csvMappingRepository.delete({ user: { id: userId } });

    const newMappings = mappings.map((m) =>
      this.csvMappingRepository.create({
        user: { id: userId },
        ourSystemColumn: m.busyfoolColumn,
        posColumnName: m.posColumnName.trim(),
      }),
    );

    return this.csvMappingRepository.save(newMappings);
  }

  async importSales(filePath: string, userId: string, confirm: boolean) {
    const mappings = await this.csvMappingRepository.find({
      where: { user: { id: userId } },
    });
    if (!mappings.length)
      throw new BadRequestException('No CSV mapping found for this user.');

    const mappingDict = mappings.reduce(
      (acc, m) => ({
        ...acc,
        [m.ourSystemColumn]: m.posColumnName.trim().toLowerCase(),
      }),
      {} as { [key: string]: string },
    );

    const fileExt = filePath.split('.').pop()?.toLowerCase();
    let dataRows: any[] = [];

    if (fileExt === 'csv') {
      dataRows = await new Promise((resolve, reject) => {
        const rows: any[] = [];
        csvParser
          .parseFile(filePath, { headers: true })
          .on('data', (row) => {
            const normalizedRow = Object.fromEntries(
              Object.entries(row).map(([k, v]) => [
                k.trim().toLowerCase(),
                v,
              ]),
            );
            rows.push(normalizedRow);
          })
          .on('end', () => resolve(rows))
          .on('error', reject);
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      const headers = rawRows[0].map((h: string) => h.trim().toLowerCase());
      dataRows = rawRows.slice(1).map((row: any[]) => {
        const rowObj: { [key: string]: any } = {};
        headers.forEach((header: string, index: number) => {
          rowObj[header] = row[index];
        });
        return rowObj;
      });
    } else {
      throw new BadRequestException(
        'Unsupported file format. Please upload a .csv or .xlsx file.',
      );
    }

    return this._processData(dataRows, mappingDict, userId, confirm, filePath);
  }

  async importDailySales(filePath: string, userId: string, confirm: boolean) {
    const mappings = await this.csvMappingRepository.find({
      where: { user: { id: userId } },
    });
    if (!mappings.length)
      throw new BadRequestException('No CSV mapping found for this user.');

    const mappingDict = mappings.reduce(
      (acc, m) => ({
        ...acc,
        [m.ourSystemColumn]: m.posColumnName.trim().toLowerCase(),
      }),
      {} as { [key: string]: string },
    );

    const fileExt = filePath.split('.').pop()?.toLowerCase();
    let dataRows: any[] = [];

    if (fileExt === 'csv') {
      dataRows = await new Promise((resolve, reject) => {
        const rows: any[] = [];
        csvParser
          .parseFile(filePath, { headers: true })
          .on('data', (row) => {
            const normalizedRow = Object.fromEntries(
              Object.entries(row).map(([k, v]) => [
                k.trim().toLowerCase(),
                v,
              ]),
            );
            rows.push(normalizedRow);
          })
          .on('end', () => resolve(rows))
          .on('error', reject);
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      const headers = rawRows[0].map((h: string) => h.trim().toLowerCase());
      dataRows = rawRows.slice(1).map((row: any[]) => {
        const rowObj: { [key: string]: any } = {};
        headers.forEach((header: string, index: number) => {
          rowObj[header] = row[index];
        });
        return rowObj;
      });
    } else {
      throw new BadRequestException(
        'Unsupported file format. Please upload a .csv or .xlsx file.',
      );
    }

    return this._processDailyData(dataRows, mappingDict, userId, confirm, filePath);
  }

  async getDailySales(userId: string, startDate?: string, endDate?: string): Promise<DailySales[]> {
    const query = this.saleRepository.createQueryBuilder('sale')
      .select([
        "DATE(sale.sale_date) as date",
        "SUM(sale.total_amount) as totalSales",
        "SUM((sale.total_amount - (product.total_cost * sale.quantity))) as totalProfit",
        "SUM(sale.quantity) as itemsSold"
      ])
      .innerJoin('sale.product', 'product')
      .where('sale.userId = :userId', { userId })
      .groupBy("DATE(sale.sale_date)");

    if (startDate) query.andWhere('sale.sale_date >= :startDate', { startDate: new Date(startDate) });
    if (endDate) query.andWhere('sale.sale_date <= :endDate', { endDate: new Date(endDate) });

    const results = await query.getRawMany();
    return results.map(row => ({
      date: row.date,
      totalSales: parseFloat(row.totalSales) || 0,
      totalProfit: parseFloat(row.totalProfit) || 0,
      itemsSold: parseInt(row.itemsSold) || 0,
    }));
  }

  private async _processData(
    dataRows: any[],
    mappingDict: { [key: string]: string },
    userId: string,
    confirm: boolean,
    filePath: string,
  ): Promise<Insight> {
    const insights: Insight = {
      totalSales: 0,
      totalProfit: 0,
      avgProfitMargin: 0,
      rows: [],
    };
    let saleCount = 0;

    const filenameMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const defaultSaleDate = filenameMatch ? new Date(filenameMatch[1]) : null;

    for (const row of dataRows) {
      const productName = row[mappingDict.product_name] || '';
      if (!productName) {
        this.logger.warn(
          `Skipping row due to empty productName. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const quantitySold = parseInt(row[mappingDict.quantity_sold] || '1');
      const totalSalePrice = parseFloat(row[mappingDict.sale_price] || '0');
      const unitPrice = quantitySold > 0 ? totalSalePrice / quantitySold : 0;
      const saleDate = mappingDict.sale_date
        ? new Date(row[mappingDict.sale_date])
        : defaultSaleDate;

      if (isNaN(quantitySold) || isNaN(totalSalePrice)) {
        this.logger.warn(
          `Skipping row due to invalid quantity or price. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const mappedRow = { productName, quantitySold, salePrice: totalSalePrice, unitPrice, saleDate };

      let product = await this.productRepository.findOne({
        where: { name: productName.toLowerCase() }, // Case-insensitive lookup
      });
      if (!product) {
        // Use TypeORM's upsert to prevent duplicates with unique constraint
        await this.productRepository.upsert(
          {
            name: productName.toLowerCase(),
            total_cost: 0,
            category: 'uncategorized',
            sell_price: unitPrice,
            status: 'new',
            quantity_sold: quantitySold,
          },
          { conflictPaths: ['name'], skipUpdateIfNoValuesChanged: true }
        );
        product = await this.productRepository.findOneOrFail({ where: { name: productName.toLowerCase() } });
      } else {
        // Update existing product
        const totalQuantity = (product.quantity_sold || 0) + quantitySold;
        const newSellPrice = ((product.sell_price * (product.quantity_sold || 0)) + totalSalePrice) / totalQuantity;
        product.sell_price = newSellPrice;
        product.quantity_sold = totalQuantity;
        await this.productRepository.save(product);
      }

      if (confirm) {
        const sale = this.saleRepository.create({
          user: { id: userId },
          product: { id: product.id },
          quantity: quantitySold,
          total_amount: totalSalePrice,
          sale_date: saleDate,
        });
        await this.saleRepository.save(sale);
      }

      const profit = (unitPrice - (product.total_cost || 0)) * quantitySold;
      const rowTotalSales = unitPrice * quantitySold;
      insights.totalSales += rowTotalSales;
      insights.totalProfit += profit;
      saleCount += quantitySold;

      insights.rows.push({ ...mappedRow, profit });
    }

    insights.avgProfitMargin =
      saleCount > 0
        ? (insights.totalProfit / insights.totalSales) * 100
        : 0;

    return insights;
  }

  private async _processDailyData(
    dataRows: any[],
    mappingDict: { [key: string]: string },
    userId: string,
    confirm: boolean,
    filePath: string,
  ): Promise<Insight> {
    const insights: Insight = {
      totalSales: 0,
      totalProfit: 0,
      avgProfitMargin: 0,
      rows: [],
    };
    let saleCount = 0;

    const filenameMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const defaultSaleDate = filenameMatch ? new Date(filenameMatch[1]) : null;

    for (const row of dataRows) {
      const productName = row[mappingDict.product_name] || '';
      if (!productName) {
        this.logger.warn(
          `Skipping row due to empty productName. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const quantitySold = parseInt(row[mappingDict.quantity_sold] || '1');
      const totalSalePrice = parseFloat(row[mappingDict.sale_price] || '0');
      const unitPrice = quantitySold > 0 ? totalSalePrice / quantitySold : 0;
      const saleDate = defaultSaleDate; // Use filename date for daily sales

      if (isNaN(quantitySold) || isNaN(totalSalePrice)) {
        this.logger.warn(
          `Skipping row due to invalid quantity or price. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const mappedRow = { productName, quantitySold, salePrice: totalSalePrice, unitPrice, saleDate };

      let product = await this.productRepository.findOne({
        where: { name: productName.toLowerCase() }, // Case-insensitive lookup
      });
      if (!product) {
        // Use upsert to prevent duplicates
        await this.productRepository.upsert(
          {
            name: productName.toLowerCase(),
            total_cost: 0,
            category: 'uncategorized',
            sell_price: unitPrice,
            status: 'new',
            quantity_sold: quantitySold,
          },
          { conflictPaths: ['name'], skipUpdateIfNoValuesChanged: true }
        );
        product = await this.productRepository.findOneOrFail({ where: { name: productName.toLowerCase() } });
      } else {
        const totalQuantity = (product.quantity_sold || 0) + quantitySold;
        const newSellPrice = ((product.sell_price * (product.quantity_sold || 0)) + totalSalePrice) / totalQuantity;
        product.sell_price = newSellPrice;
        product.quantity_sold = totalQuantity;
        await this.productRepository.save(product);
      }

      if (confirm) {
        const sale = this.saleRepository.create({
          user: { id: userId },
          product: { id: product.id },
          quantity: quantitySold,
          total_amount: totalSalePrice,
          sale_date: saleDate,
        });
        await this.saleRepository.save(sale);
      }

      const profit = (unitPrice - (product.total_cost || 0)) * quantitySold;
      const rowTotalSales = unitPrice * quantitySold;
      insights.totalSales += rowTotalSales;
      insights.totalProfit += profit;
      saleCount += quantitySold;

      insights.rows.push({ ...mappedRow, profit });
    }

    insights.avgProfitMargin =
      saleCount > 0
        ? (insights.totalProfit / insights.totalSales) * 100
        : 0;

    return insights;
  }
}