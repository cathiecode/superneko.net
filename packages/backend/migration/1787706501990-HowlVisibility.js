/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class HowlVisibility1787706501990 {
    name = 'HowlVisibility1787706501990'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "live_stream" ADD "visibility" character varying(16) NOT NULL DEFAULT 'local'`)
        await queryRunner.query(`ALTER TABLE "live_stream" ADD "guestTokenHash" character varying(64)`)
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "live_stream" DROP COLUMN "guestTokenHash"`)
        await queryRunner.query(`ALTER TABLE "live_stream" DROP COLUMN "visibility"`)
    }
}
