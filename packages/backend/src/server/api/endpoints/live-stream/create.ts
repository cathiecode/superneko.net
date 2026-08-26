/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { liveStreamSchema } from './_schemas.js';

export const meta = {
	tags: ['live-stream'], requireCredential: true, secure: true, prohibitMoved: true, kind: 'write:account',
	limit: { duration: 60 * 60 * 1000, max: 10 },
	res: { type: 'object', optional: false, nullable: false, properties: {
		stream: liveStreamSchema,
		publishUrl: { type: 'string', optional: false, nullable: false },
		guestUrl: { type: 'string', optional: false, nullable: true },
		rtspUrl: { type: 'string', optional: false, nullable: true },
	} },
	errors: { activeStreamExists: { message: 'An active live stream already exists.', code: 'ACTIVE_LIVE_STREAM_EXISTS', id: '6f06ca17-4a5c-4251-85ab-736c97fa7cba' } },
} as const;
export const paramDef = { type: 'object', properties: {
	title: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
	visibility: { type: 'string', enum: ['followers', 'local', 'public'], default: 'local' },
}, required: ['title'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.config) config: Config, liveStreamingService: LiveStreamingService) {
		super(meta, paramDef, async (ps, me) => {
			if (config.liveStreaming == null) throw new Error('Live streaming is not configured.');
			try {
				const { stream, publishToken, guestToken } = await liveStreamingService.create(me, ps.title.trim(), ps.visibility);
				return {
					stream: await liveStreamingService.pack(stream, me),
					publishUrl: `${config.liveStreaming.rtmpUrl}/${stream.mediaPath}?token=${publishToken}`,
					guestUrl: guestToken == null ? null : `${config.url}/live/${stream.id}?guest=${guestToken}`,
					rtspUrl: guestToken == null ? null : `${config.liveStreaming.rtspUrl}/${stream.mediaPath}?token=${guestToken}`,
				};
			} catch (error) {
				if (error instanceof Error && error.message === 'ACTIVE_LIVE_STREAM_EXISTS') throw new ApiError(meta.errors.activeStreamExists);
				throw error;
			}
		});
	}
}
