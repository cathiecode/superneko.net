/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
export const meta = { tags: ['live-stream'], requireCredential: true, prohibitMoved: true, kind: 'write:account', limit: { duration: 60 * 1000, max: 60 }, errors: { noSuchStream: { message: 'No such owned active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: 'ffdabe45-12ce-48bb-895f-2558750c755d' }, noSuchMessage: { message: 'No such chat message.', code: 'NO_SUCH_LIVE_STREAM_CHAT_MESSAGE', id: 'a133c396-8ece-4567-96dc-efc2e90c6495' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' }, messageId: { type: 'string', format: 'misskey:id' } }, required: ['streamId', 'messageId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream || stream.userId !== me.id) throw new ApiError(meta.errors.noSuchStream); if (!await service.deleteChatMessage(stream, ps.messageId)) throw new ApiError(meta.errors.noSuchMessage); }); }
}
