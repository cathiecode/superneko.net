/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['live-stream'], requireCredential: false,
	limit: { duration: 60 * 1000, max: 30 },
	res: { type: 'object', optional: false, nullable: false, properties: {
		playbackUrl: { type: 'string', optional: false, nullable: false },
		token: { type: 'string', optional: false, nullable: false },
	} },
	errors: { noSuchStream: { message: 'No such public live stream or invalid guest token.', code: 'NO_SUCH_LIVE_STREAM', id: 'cb32b44d-4015-47fb-975b-035cb8a4b9f2' } },
} as const;
export const paramDef = { type: 'object', properties: {
	streamId: { type: 'string', format: 'misskey:id' },
	guestToken: { type: 'string', minLength: 16, maxLength: 128 },
	name: { type: 'string', minLength: 1, maxLength: 30, pattern: '\\S' },
}, required: ['streamId', 'guestToken', 'name'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) {
		super(meta, paramDef, async (ps) => {
			const stream = await service.getActive(ps.streamId);
			const playback = stream == null ? null : await service.joinGuest(stream, ps.guestToken, ps.name.trim());
			if (playback == null) throw new ApiError(meta.errors.noSuchStream);
			return playback;
		});
	}
}
