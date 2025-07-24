import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  purchase_price: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  waste_percent: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ type: 'float', nullable: true })
  cost_per_ml: number | null;

  @Column({ type: 'float', nullable: true })
  cost_per_gram: number | null;

  @Column({ type: 'float', nullable: true })
  cost_per_unit: number | null;

  @Column({ length: 100, nullable: true })
  supplier: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}