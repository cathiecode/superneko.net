export class MuteInLocalListing1691052768536 {
    name = 'MuteInLocalListing1691052768536'

    async up(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD "muteInLocalListing" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."muteInLocalListing" IS 'Whether posts from the User should be listed in LTL.'
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`
            COMMENT ON COLUMN "user"."muteInLocalListing" IS 'Whether posts from the User should be listed in LTL.'
        `);
        await queryRunner.query(`
            ALTER TABLE "user" DROP COLUMN "muteInLocalListing"
        `);
    }
}
