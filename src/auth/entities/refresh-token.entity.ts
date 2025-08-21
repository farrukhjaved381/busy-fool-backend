import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'text' })         // store hash, not raw token
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'text', nullable: true })
  replacedByTokenId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
