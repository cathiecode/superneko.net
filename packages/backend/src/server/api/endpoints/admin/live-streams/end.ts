/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
// A dedicated OAuth scope would be preferable, but adding one would be a wider compatibility change.
export const meta = { tags: ['admin'], requireCredential: true, requireModerator: true, kind: 'write:admin:suspend-user', limit: { duration: 60 * 1000, max: 20 }, errors: { noSuchStream: { message: 'No such active live stream.', code: 'NO_SUCH_LIVE_STREAM', id: '64c45da5-0254-4a54-b29d-874f5b4eb07b' } } } as const;
export const paramDef = { type: 'object', properties: { streamId: { type: 'string', format: 'misskey:id' } }, required: ['streamId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async ps => { const stream = await service.getActive(ps.streamId); if (!stream) throw new ApiError(meta.errors.noSuchStream); await service.finish(stream.id); }); }
}
