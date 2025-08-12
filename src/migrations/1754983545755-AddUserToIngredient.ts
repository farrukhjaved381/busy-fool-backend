import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserToIngredient1754983545755 implements MigrationInterface {
    name = 'AddUserToIngredient1754983545755'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingredient" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "ingredient" ADD CONSTRAINT "FK_d621784b59b05016938180fb3bb" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingredient" DROP CONSTRAINT "FK_d621784b59b05016938180fb3bb"`);
        await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "userId"`);
    }

}
