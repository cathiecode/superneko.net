/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
export const meta = { tags: ['live-stream'], requireCredential: true, kind: 'read:account', limit: { duration: 60 * 1000, max: 30 }, res: { type: 'object', optional: false, nullable: false, properties: { playbackUrl: { type: 'string', optional: false, nullable: false }, token: { type: 'string', optional: false, nullable: false } } }, errors: { noSuchStream: { message: 'No such active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: 'c1f6d86b-9db6-4fd7-a413-0867df582bff' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' }, anonymous: { type: 'boolean', default: true } }, required: ['streamId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream || !await service.canView(stream, me)) throw new ApiError(meta.errors.noSuchStream); return await service.join(stream, me, ps.anonymous); }); }
}
