/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { liveStreamSchema } from './_schemas.js';
export const meta = { tags: ['live-stream'], requireCredential: true, kind: 'read:account', res: liveStreamSchema, errors: { noSuchStream: { message: 'No such active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: 'a9cb9cee-d78d-4c08-9f2d-2c8c595a4c37' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' } }, required: ['streamId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (ps, me) => { const stream = await service.getActive(ps.streamId); if (!stream) throw new ApiError(meta.errors.noSuchStream); return await service.pack(stream, me); }); }
}
