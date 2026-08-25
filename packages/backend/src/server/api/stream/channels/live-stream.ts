/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { bindThis } from '@/decorators.js';
import type { JsonObject } from '@/misc/json-value.js';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import Channel, { type ChannelRequest } from '../channel.js';

@Injectable({ scope: Scope.TRANSIENT })
export class LiveStreamChannel extends Channel {
	public readonly chName = 'liveStream';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';

	constructor(
		@Inject(REQUEST) request: ChannelRequest,
		private liveStreamingService: LiveStreamingService,
	) { super(request); }

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.streamId !== 'string' || await this.liveStreamingService.getActive(params.streamId) == null) return false;
		this.subscriber.on(`liveStream:${params.streamId}`, data => this.send(data.type, data.body));
		return true;
	}
}
