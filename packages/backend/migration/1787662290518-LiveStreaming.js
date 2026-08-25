/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class LiveStreaming1787662290518 {
	name = 'LiveStreaming1787662290518'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "live_stream" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(200) NOT NULL, "mediaPath" character varying(128) NOT NULL, "publishTokenHash" character varying(64) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'waiting', "startedAt" TIMESTAMP WITH TIME ZONE, "disconnectedAt" TIMESTAMP WITH TIME ZONE, "endedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_live_stream" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_e7557e7990554576e59e11ab86" ON "live_stream" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7056688ba7a9d31159ed9af712" ON "live_stream" ("mediaPath")`);
		await queryRunner.query(`CREATE INDEX "IDX_334ba6b6013738f877b68c4360" ON "live_stream" ("status")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_live_stream_active_user" ON "live_stream" ("userId") WHERE "status" <> 'ended'`);
		await queryRunner.query(`CREATE TABLE "live_stream_chat_message" ("id" character varying(32) NOT NULL, "streamId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "text" character varying(1000) NOT NULL, "isAnonymous" boolean NOT NULL DEFAULT false, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_live_stream_chat_message" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_9af7f9fcd95d8a5f558c09da0f" ON "live_stream_chat_message" ("streamId")`);
		await queryRunner.query(`CREATE INDEX "IDX_64a178d42a0da0e50aeaec216c" ON "live_stream_chat_message" ("userId")`);
		await queryRunner.query(`ALTER TABLE "live_stream" ADD CONSTRAINT "FK_e7557e7990554576e59e11ab862" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "live_stream_chat_message" ADD CONSTRAINT "FK_9af7f9fcd95d8a5f558c09da0fd" FOREIGN KEY ("streamId") REFERENCES "live_stream"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "live_stream_chat_message" ADD CONSTRAINT "FK_64a178d42a0da0e50aeaec216c7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "live_stream_chat_message" DROP CONSTRAINT "FK_64a178d42a0da0e50aeaec216c7"`);
		await queryRunner.query(`ALTER TABLE "live_stream_chat_message" DROP CONSTRAINT "FK_9af7f9fcd95d8a5f558c09da0fd"`);
		await queryRunner.query(`ALTER TABLE "live_stream" DROP CONSTRAINT "FK_e7557e7990554576e59e11ab862"`);
		await queryRunner.query(`DROP TABLE "live_stream_chat_message"`);
		await queryRunner.query(`DROP TABLE "live_stream"`);
	}
}
