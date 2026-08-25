/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { liveStreamSchema } from './_schemas.js';
export const meta = { tags: ['live-stream'], requireCredential: true, kind: 'read:account', res: { type: 'array', optional: false, nullable: false, items: liveStreamSchema } } as const;
export const paramDef = { type: 'object', properties: {}, required: [] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: LiveStreamingService) { super(meta, paramDef, async (_ps, me) => await Promise.all((await service.getFollowing(me.id)).map(stream => service.pack(stream, me)))); }
}
