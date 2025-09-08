/*
 * SPDX-FileCopyrightText: cathiecode
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ByeMuteInLocalListing1723475293689 {
    name = 'ByeMuteInLocalListing1723475293689'

    async up(queryRunner) {
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."muteInLocalListing" IS 'Whether posts from the User should be listed in LTL.'
        `);
        await queryRunner.query(`
            ALTER TABLE "user" DROP COLUMN "muteInLocalListing"
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD "muteInLocalListing" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."muteInLocalListing" IS 'Whether posts from the User should be listed in LTL.'
        `);
    }
}
