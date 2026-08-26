/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RemoveLocalHowlVisibility1787728373029 {
    name = 'RemoveLocalHowlVisibility1787728373029'

    async up(queryRunner) {
        await queryRunner.query(`UPDATE "live_stream" SET "visibility" = 'followers' WHERE "visibility" = 'local'`)
        await queryRunner.query(`ALTER TABLE "live_stream" ALTER COLUMN "visibility" SET DEFAULT 'followers'`)
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "live_stream" ALTER COLUMN "visibility" SET DEFAULT 'local'`)
        // Previously local rows cannot be distinguished from followers after migration.
    }
}
