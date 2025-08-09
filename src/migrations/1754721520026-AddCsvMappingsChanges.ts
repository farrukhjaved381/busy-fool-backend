import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCsvMappingsChanges1754721520026 implements MigrationInterface {
    name = 'AddCsvMappingsChanges1754721520026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "csv_mappings" ("id" SERIAL NOT NULL, "ourSystemColumn" character varying NOT NULL, "posColumnName" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_d80a9d261a2a39cc3885fb7f08f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "csv_mappings" ADD CONSTRAINT "FK_2b4da2f369119196bc5a18fd308" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csv_mappings" DROP CONSTRAINT "FK_2b4da2f369119196bc5a18fd308"`);
        await queryRunner.query(`DROP TABLE "csv_mappings"`);
    }

}