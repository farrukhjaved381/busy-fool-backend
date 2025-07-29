import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Stock } from '../../stock/entities/stock.entity';

@Entity()
export class Waste {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Stock, stock => stock.wastes)
  @JoinColumn()
  stock: Stock;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  quantity: number;

  @Column({ length: 50, nullable: false })
  unit: string;

  @Column({ length: 255, nullable: false })
  reason: string;

  @CreateDateColumn()
  wasteDate: Date;
}