import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity()
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ingredient, ingredient => ingredient.stocks)
  @JoinColumn()
  ingredient: Ingredient;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  purchased_quantity: number;

  @Column({ length: 50, nullable: false })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  purchase_price: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false })
  waste_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  remaining_quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false, default: 0 })
  wasted_quantity: number;

  @CreateDateColumn()
  purchased_at: Date;

  @CreateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}