import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedAtToProduct1753318014607 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "last_updated"`);
    await queryRunner.query(`ALTER TABLE "product" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "ingredient" ADD "name" character varying(100)`); // Add without NOT NULL first
    await queryRunner.query(`UPDATE "ingredient" SET "name" = 'Unknown' WHERE "name" IS NULL`); // Set default for NULLs
    await queryRunner.query(`ALTER TABLE "ingredient" ALTER COLUMN "name" SET NOT NULL`); // Add NOT NULL constraint
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ingredient" ALTER COLUMN "name" DROP NOT NULL`); // Remove NOT NULL if needed
    await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "ingredient" ADD "name" ...`); // Revert to original
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "ingredient" ADD "last_updated" ...`); // Revert to original
  }
}