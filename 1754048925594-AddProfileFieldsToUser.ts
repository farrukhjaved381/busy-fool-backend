import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileFieldsToUser1754048925594 implements MigrationInterface {
    name = 'AddProfileFieldsToUser1754048925594'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "profilePicture" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phoneNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "address" text`);
        await queryRunner.query(`ALTER TABLE "user" ADD "bio" text`);
        await queryRunner.query(`ALTER TABLE "user" ADD "dateOfBirth" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "dateOfBirth"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bio"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumber"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "profilePicture"`);
    }

}
