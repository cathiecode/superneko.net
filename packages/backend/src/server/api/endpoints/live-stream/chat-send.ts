/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { chatMessageSchema } from './_schemas.js';
export const meta = { tags: ['live-stream'], requireCredential: true, prohibitMoved: true, kind: 'write:account', limit: { duration: 60 * 1000, max: 30 }, res: chatMessageSchema, errors: { noSuchStream: { message: 'No such active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: '8bfa45e3-0c7d-4b39-b210-9b24455fefdc' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' }, text: { type: 'string', minLength: 1, maxLength: 1000, pattern: '\\S' }, anonymous: { type: 'boolean', default: false } }, required: ['streamId', 'text'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream) throw new ApiError(meta.errors.noSuchStream); return await service.createChatMessage(stream, me, ps.text.trim(), ps.anonymous); }); }
}
