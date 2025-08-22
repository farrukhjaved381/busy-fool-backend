import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsvMappings } from './entities/csv-mappings.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';
import * as csvParser from 'fast-csv';
import * as XLSX from 'xlsx';

interface InsightRow {
  productName: string;
  quantitySold: number;
  amount: number; // total amount for this CSV row
  unitPrice: number;
  saleDate: Date | null;
  profit: number;
  profitMargin: number; // % for this row
}

interface Insight {
  totalSales: number;
  totalProfit: number;
  avgProfitMargin: number;
  rows: InsightRow[];
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

  // -------------------------
  // Helpers
  // -------------------------
  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    // Remove currency symbols, spaces and thousands separators
    const cleaned = s.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private normalizeHeader(header: string): string {
    return header ? header.trim().toLowerCase() : header;
  }

  // -------------------------
  // Read headers (CSV or XLSX)
  // -------------------------
  async getCsvHeaders(filePath: string): Promise<string[]> {
    const fileExt = filePath.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      return new Promise((resolve, reject) => {
        csvParser
          .parseFile(filePath, { headers: true })
          .on('headers', (hdrs: string[]) => {
            resolve(hdrs.map((h) => this.normalizeHeader(h)));
          })
          .on('error', reject);
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        });
        if (!rawRows || rawRows.length === 0)
          throw new BadRequestException('No data found in Excel file.');
        const headers = (rawRows[0] as any[]).map((h) =>
          this.normalizeHeader(String(h || '')),
        );
        return headers;
      } catch (err) {
        throw new BadRequestException(
          'Failed to read Excel file: ' + (err?.message || err),
        );
      }
    } else {
      throw new BadRequestException(
        'Unsupported file format. Please upload .csv or .xlsx',
      );
    }
  }

  // -------------------------
  // Save mapping
  // -------------------------
  async saveMapping(
    userId: string,
    mappings: { busyfoolColumn: string; posColumnName: string }[],
  ) {
    await this.csvMappingRepository.delete({ user: { id: userId } });

    const newMappings = mappings.map((m) =>
      this.csvMappingRepository.create({
        user: { id: userId },
        ourSystemColumn: m.busyfoolColumn,
        posColumnName: this.normalizeHeader(m.posColumnName),
      }),
    );

    return this.csvMappingRepository.save(newMappings);
  }

  // -------------------------
  // Parse file into normalized rows (lowercase headers)
  // -------------------------
  private async parseFileToRows(
    filePath: string,
  ): Promise<Record<string, any>[]> {
    const fileExt = filePath.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      return new Promise<Record<string, any>[]>((resolve, reject) => {
        const rows: Record<string, any>[] = [];
        csvParser
          .parseFile(filePath, { headers: true })
          .on('data', (row: Record<string, any>) => {
            const normalized: Record<string, any> = {};
            Object.entries(row).forEach(([k, v]) => {
              const key = this.normalizeHeader(String(k || ''));
              normalized[key] = v;
            });
            rows.push(normalized);
          })
          .on('end', () => resolve(rows))
          .on('error', reject);
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });
      if (!rawRows || rawRows.length < 1) return [];
      const headers = (rawRows[0] as any[]).map((h) =>
        this.normalizeHeader(String(h || '')),
      );
      const dataRows = rawRows.slice(1).map((r: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          obj[h] = r?.[i];
        });
        return obj;
      });
      return dataRows;
    } else {
      throw new BadRequestException('Unsupported file format.');
    }
  }

  // -------------------------
  // Import generic CSV sales (per-row Amount used)
  // -------------------------
  async importSales(
    filePath: string,
    userId: string,
    confirm = false,
  ): Promise<Insight> {
    const mappings = await this.csvMappingRepository.find({
      where: { user: { id: userId } },
    });
    if (!mappings || mappings.length === 0) {
      throw new BadRequestException('No CSV mapping found for this user.');
    }

    const mappingDict = mappings.reduce(
      (acc, m) => ({ ...acc, [m.ourSystemColumn]: m.posColumnName }),
      {} as Record<string, string>,
    );

    const dataRows = await this.parseFileToRows(filePath);
    return this._processData(dataRows, mappingDict, userId, confirm, filePath);
  }

  // -------------------------
  // Import daily sales (uses filename date fallback)
  // -------------------------
  async importDailySales(
    filePath: string,
    userId: string,
    confirm = false,
  ): Promise<Insight> {
    const mappings = await this.csvMappingRepository.find({
      where: { user: { id: userId } },
    });
    if (!mappings || mappings.length === 0) {
      throw new BadRequestException('No CSV mapping found for this user.');
    }

    const mappingDict = mappings.reduce(
      (acc, m) => ({ ...acc, [m.ourSystemColumn]: m.posColumnName }),
      {} as Record<string, string>,
    );

    const dataRows = await this.parseFileToRows(filePath);
    return this._processDailyData(
      dataRows,
      mappingDict,
      userId,
      confirm,
      filePath,
    );
  }

  // -------------------------
  // Daily aggregation endpoint helper
  // -------------------------
  async getDailySales(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DailySales[]> {
    // Use repository query builder to aggregate by sale_date
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.product', 'product')
      .select('DATE(sale.sale_date)', 'date')
      .addSelect('SUM(sale.total_amount)', 'totalSales')
      .addSelect(
        'SUM(sale.total_amount - (COALESCE(product.total_cost,0) * sale.quantity))',
        'totalProfit',
      )
      .addSelect('SUM(sale.quantity)', 'itemsSold')
      .where('sale.userId = :userId', { userId })
      .groupBy('DATE(sale.sale_date)');

    if (startDate)
      qb.andWhere('sale.sale_date >= :startDate', {
        startDate: new Date(startDate),
      });
    if (endDate)
      qb.andWhere('sale.sale_date <= :endDate', { endDate: new Date(endDate) });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      date: r.date,
      totalSales: parseFloat(r.totalsales) || 0,
      totalProfit: parseFloat(r.totalprofit) || 0,
      itemsSold: parseInt(r.itemssold, 10) || 0,
    }));
  }

  // -------------------------
  // Core processing (generic importSales)
  // -------------------------
  private async _processData(
    dataRows: Record<string, any>[],
    mappingDict: Record<string, string>,
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
    const filenameMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const defaultSaleDate = filenameMatch ? new Date(filenameMatch[1]) : null;

    for (const row of dataRows) {
      // mappingDict keys like mappingDict['product_name'] => 'item name' (lowercase)
      const productKey = mappingDict['product_name'];
      const qtyKey =
        mappingDict['quantity_sold'] ||
        mappingDict['quantity'] ||
        mappingDict['qty'];
      const priceKey =
        mappingDict['sale_price'] ||
        mappingDict['amount'] ||
        mappingDict['price'];
      const dateKey = mappingDict['sale_date'] || mappingDict['date'];

      // row keys are normalized to lowercase headers
      const productName = productKey
        ? String(row[this.normalizeHeader(productKey)] || '').trim()
        : row['item name'] || row['item'] || row['product'] || '';
      if (!productName) {
        this.logger.warn(
          `Skipping row due to empty productName. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const qtyRaw = qtyKey
        ? row[this.normalizeHeader(qtyKey)]
        : row['quantity'] || row['qty'] || '1';
      const amountRaw = priceKey
        ? row[this.normalizeHeader(priceKey)]
        : row['amount'] || row['price'] || '0';

      const quantitySold = Number.isFinite(qtyRaw)
        ? Number(qtyRaw)
        : this.parseNumber(qtyRaw);
      const amount = Number.isFinite(amountRaw)
        ? Number(amountRaw)
        : this.parseNumber(amountRaw);

      if (!quantitySold || quantitySold <= 0) {
        this.logger.warn(
          `Skipping row due to invalid quantity. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      // unit price = amount / quantity
      const unitPrice = amount / quantitySold;
      const saleDate =
        dateKey && row[this.normalizeHeader(dateKey)]
          ? new Date(row[this.normalizeHeader(dateKey)])
          : defaultSaleDate;

      // Find product case-insensitively
      let productRecord: Product | null = await this.productRepository
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: productName })
        .andWhere('p.userId = :userId', { userId })
        .getOne();

      if (!productRecord) {
        productRecord = this.productRepository.create({
          name: productName,
          total_cost: 0,
          category: 'uncategorized',
          status: 'new',
          user: { id: userId }, // Associate with the current user
          sell_price: 0, // Default sell price to 0
        });
        await this.productRepository.save(productRecord);
      }
      // Ensure productRecord is not null for subsequent operations
      if (!productRecord) {
        throw new Error('Product record should not be null at this point.');
      }

      // Profit = amount (CSV total) - product.total_cost * quantity
      const productTotalCost = this.parseNumber(
        (productRecord as any).total_cost,
      );
      const profit = amount - productTotalCost * quantitySold;
      const profitMargin = amount > 0 ? (profit / amount) * 100 : 0;

      // If confirm true, save Sale row
      if (confirm) {
        const sale = this.saleRepository.create({
          user: { id: userId },
          product: { id: productRecord.id },
          product_name: productRecord.name,
          quantity: quantitySold,
          total_amount: amount,
          sale_date: saleDate,
        } as any);
        await this.saleRepository.save(sale);

        // Manually update quantity_sold for the product
        console.log(`CSV Import: Product ${productRecord.name} (ID: ${productRecord.id}) - quantity_sold BEFORE update: ${productRecord.quantity_sold}`);
        console.log(`CSV Import: Sale quantity: ${quantitySold}`);
        productRecord.quantity_sold =
          Number(productRecord.quantity_sold) + Number(quantitySold);
        console.log(`CSV Import: Product ${productRecord.name} (ID: ${productRecord.id}) - quantity_sold AFTER update: ${productRecord.quantity_sold}`);
        await this.productRepository.save(productRecord);
      }

      insights.totalSales += amount;
      insights.totalProfit += profit;
      insights.rows.push({
        productName: productRecord.name,
        quantitySold,
        amount,
        unitPrice,
        saleDate,
        profit,
        profitMargin,
      });
    }

    insights.avgProfitMargin =
      insights.totalSales > 0
        ? (insights.totalProfit / insights.totalSales) * 100
        : 0;
    return insights;
  }

  // -------------------------
  // Core processing for daily files (prefers filename date)
  // -------------------------
  private async _processDailyData(
    dataRows: Record<string, any>[],
    mappingDict: Record<string, string>,
    userId: string,
    confirm: boolean,
    filePath: string,
  ): Promise<Insight> {
    // This reuses the same logic but forces saleDate = filename date (if present),
    // which is typical for reports named like items-report-YYYY-MM-DD_YYYY-MM-DD.csv
    const filenameMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const defaultSaleDate = filenameMatch ? new Date(filenameMatch[1]) : null;

    // Call the generic processor but override date usage:
    // We'll copy/paste similar logic but set saleDate = defaultSaleDate always (unless mapping gives explicit date).
    const insights: Insight = {
      totalSales: 0,
      totalProfit: 0,
      avgProfitMargin: 0,
      rows: [],
    };

    for (const row of dataRows) {
      const productKey = mappingDict['product_name'];
      const qtyKey =
        mappingDict['quantity_sold'] ||
        mappingDict['quantity'] ||
        mappingDict['qty'];
      const priceKey =
        mappingDict['sale_price'] ||
        mappingDict['amount'] ||
        mappingDict['price'];
      const dateKey = mappingDict['sale_date'] || mappingDict['date'];

      const productName = productKey
        ? String(row[this.normalizeHeader(productKey)] || '').trim()
        : row['item name'] || row['item'] || row['product'] || '';
      if (!productName) {
        this.logger.warn(
          `Skipping row due to empty productName. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const qtyRaw = qtyKey
        ? row[this.normalizeHeader(qtyKey)]
        : row['quantity'] || row['qty'] || '1';
      const amountRaw = priceKey
        ? row[this.normalizeHeader(priceKey)]
        : row['amount'] || row['price'] || '0';

      const quantitySold = Number.isFinite(qtyRaw)
        ? Number(qtyRaw)
        : this.parseNumber(qtyRaw);
      const amount = Number.isFinite(amountRaw)
        ? Number(amountRaw)
        : this.parseNumber(amountRaw);

      if (!quantitySold || quantitySold <= 0) {
        this.logger.warn(
          `Skipping row due to invalid quantity. Row data: ${JSON.stringify(row)}`,
        );
        continue;
      }

      const unitPrice = amount / quantitySold;
      // prefer filename date, but if user mapping provides explicit date value, use that
      const mappedDateVal =
        dateKey && row[this.normalizeHeader(dateKey)]
          ? new Date(row[this.normalizeHeader(dateKey)])
          : null;
      const saleDate = mappedDateVal || defaultSaleDate;

      let productRecord: Product | null = await this.productRepository
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: productName })
        .andWhere('p.userId = :userId', { userId })
        .getOne();

      if (!productRecord) {
        productRecord = this.productRepository.create({
          name: productName,
          total_cost: 0,
          category: 'uncategorized',
          status: 'new',
          user: { id: userId }, // Associate with the current user
          sell_price: 0, // Default sell price to 0
        });
        await this.productRepository.save(productRecord);
      }
      // Ensure productRecord is not null for subsequent operations
      if (!productRecord) {
        throw new Error('Product record should not be null at this point.');
      }

      const productTotalCost = this.parseNumber(
        (productRecord as any).total_cost,
      );
      const profit = amount - productTotalCost * quantitySold;
      const profitMargin = amount > 0 ? (profit / amount) * 100 : 0;

      if (confirm) {
        const sale = this.saleRepository.create({
          user: { id: userId },
          product: { id: productRecord.id },
          product_name: productRecord.name,
          quantity: quantitySold,
          total_amount: amount,
          sale_date: saleDate,
        } as any);
        await this.saleRepository.save(sale);

        // Manually update quantity_sold for the product
        console.log(`CSV Import: Product ${productRecord.name} (ID: ${productRecord.id}) - quantity_sold BEFORE update: ${productRecord.quantity_sold}`);
        console.log(`CSV Import: Sale quantity: ${quantitySold}`);
        productRecord.quantity_sold =
          Number(productRecord.quantity_sold) + Number(quantitySold);
        console.log(`CSV Import: Product ${productRecord.name} (ID: ${productRecord.id}) - quantity_sold AFTER update: ${productRecord.quantity_sold}`);
        await this.productRepository.save(productRecord);
      }

      insights.totalSales += amount;
      insights.totalProfit += profit;
      insights.rows.push({
        productName: productRecord.name,
        quantitySold,
        amount,
        unitPrice,
        saleDate,
        profit,
        profitMargin,
      });
    }

    insights.avgProfitMargin =
      insights.totalSales > 0
        ? (insights.totalProfit / insights.totalSales) * 100
        : 0;
    return insights;
  }
}
// Note: This service assumes that the CSV/XLSX files have been pre-validated and contain the necessary columns.
// It does not handle file uploads directly; that should be managed by the controller.
// The service focuses on processing the data, saving mappings, and importing sales based on user-defined mappings.
// The methods are designed to be reusable and modular, allowing for easy testing and maintenance.
// The service also includes detailed logging for debugging purposes, especially when skipping rows due to missing or invalid data.
// The use of TypeORM repositories allows for efficient database interactions, leveraging the power of query builders for complex queries.
// The service is structured to handle both generic CSV imports and daily sales reports, providing flexibility for different use cases.
// The methods are designed to be reusable and modular, allowing for easy testing and maintenance.
// The service also includes detailed logging for debugging purposes, especially when skipping rows due to missing or invalid data.
// The use of TypeORM repositories allows for efficient database interactions, leveraging the power of query builders for complex queries.
