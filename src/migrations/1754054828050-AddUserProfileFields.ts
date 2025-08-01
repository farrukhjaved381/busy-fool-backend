import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1754054828050 implements MigrationInterface {
    name = 'AddUserProfileFields1754054828050'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "profilePicture" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phoneNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "address" text`);
        await queryRunner.query(`ALTER TABLE "user" ADD "bio" text`);
        await queryRunner.query(`ALTER TABLE "user" ADD "dateOfBirth" date`);
        await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "ingredient" ADD "name" character varying(100) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingredient" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "ingredient" ADD "name" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "dateOfBirth"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumber"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "profilePicture"`);
    }

}
