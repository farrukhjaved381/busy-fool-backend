import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: false })
  unit: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  purchase_price: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  waste_percent: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  cost_per_ml: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  cost_per_gram: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cost_per_unit: number;

  @Column({ type: 'varchar', nullable: true })
  supplier: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  last_updated: Date;
}