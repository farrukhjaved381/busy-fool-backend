import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity()
export class ImportSalesUnmatched {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productName: string;

  @Column()
  quantitySold: number;

  @Column('decimal')
  salePrice: number;

  @Column()
  saleDate: Date;

  @Column({ default: false })
  isLinked: boolean;

  @ManyToOne(() => User, user => user.id)
  user: User;
}
