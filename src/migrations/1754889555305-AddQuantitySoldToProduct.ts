import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuantitySoldToProduct1754889555305
  implements MigrationInterface
{
  name = 'AddQuantitySoldToProduct1754889555305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" ADD "quantity_sold" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale" ALTER COLUMN "sale_date" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale" ALTER COLUMN "sale_date" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "UQ_22cc43e9a74d7498546e9a63e77" UNIQUE ("name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "UQ_22cc43e9a74d7498546e9a63e77"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale" ALTER COLUMN "sale_date" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale" ALTER COLUMN "sale_date" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN "quantity_sold"`,
    );
  }
}
