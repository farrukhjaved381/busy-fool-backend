import { MigrationInterface, QueryRunner } from 'typeorm';

export class FillMissingProductUserIds1755066320817
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE product p
            SET "userId" = s."userId"
            FROM sale s
            WHERE s."productId" = p.id AND p."userId" IS NULL;
        `);
  }

  public async down(): Promise<void> {}
}
