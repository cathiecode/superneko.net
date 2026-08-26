/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
export const meta = { tags: ['live-stream'], requireCredential: true, prohibitMoved: true, kind: 'write:account', limit: { duration: 60 * 1000, max: 10 }, errors: { noSuchStream: { message: 'No such owned active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: 'db91ad2a-ba42-422b-a873-effc8080d61b' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' } }, required: ['streamId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream || stream.userId !== me.id) throw new ApiError(meta.errors.noSuchStream); await service.finish(stream.id); }); }
}
