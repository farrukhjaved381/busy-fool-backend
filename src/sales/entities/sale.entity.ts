import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/user.entity';

@Entity()
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Unique identifier for the sale' })
  id: string;

  @ManyToOne(() => Product, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  @ApiProperty({
    description: 'Product sold (nullable for unregistered products)',
    type: () => Product,
    required: false,
  })
  product: Product;

  @Column({ nullable: true })
  @ApiProperty({
    description:
      'Name of the product at time of sale (for unregistered products)',
    required: false,
  })
  product_name: string;

  @ManyToOne(() => User, (user) => user.sales, { onDelete: 'CASCADE' })
  user: User;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Quantity sold (e.g., number of cups)' })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Total sale amount (quantity × sell_price)' })
  total_amount: number;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Date of the sale (optional)', required: false })
  sale_date: Date | null;
}
