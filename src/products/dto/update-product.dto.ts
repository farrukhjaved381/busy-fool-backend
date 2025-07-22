export class UpdateProductDto {
  name?: string;
  category?: string;
  sell_price?: number;
  ingredients?: Array<{
    ingredientId: string;
    quantity: number;
    unit: string;
    is_optional?: boolean;
  }>;
} 