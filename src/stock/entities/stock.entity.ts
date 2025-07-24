import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
  import { Ingredient } from '../../ingredients/entities/ingredient.entity';

  @Entity()
  export class Stock {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Ingredient, ingredient => ingredient.id)
    @JoinColumn()
    ingredient: Ingredient;

    @Column()
    quantity: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;
  }