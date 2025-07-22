import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { IngredientsService } from '../ingredients/ingredients.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchasesRepository: Repository<Purchase>,
    private ingredientsService: IngredientsService,
    private usersService: UsersService,
  ) {}

  async create(createPurchaseDto: CreatePurchaseDto, userId: string): Promise<Purchase> {
    const ingredient = await this.ingredientsService.findOne(createPurchaseDto.ingredientId);
    if (!ingredient) throw new BadRequestException('Ingredient not found');

    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const purchase = this.purchasesRepository.create({
      ingredient,
      user,
      quantity: createPurchaseDto.quantity,
      total_cost: createPurchaseDto.total_cost,
    });

    return this.purchasesRepository.save(purchase);
  }

  async findAll(): Promise<Purchase[]> {
    return this.purchasesRepository.find();
  }
}