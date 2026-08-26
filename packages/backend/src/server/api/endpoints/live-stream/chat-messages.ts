/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { chatMessageSchema } from './_schemas.js';
export const meta = { tags: ['live-stream'], requireCredential: true, kind: 'read:account', res: { type: 'array', optional: false, nullable: false, items: chatMessageSchema }, errors: { noSuchStream: { message: 'No such active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: '2bb875d5-6c6b-4949-948b-496e62d119ac' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' } }, required: ['streamId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream || !await service.canView(stream, me)) throw new ApiError(meta.errors.noSuchStream); return await service.listChatMessages(stream, me); }); }
}
