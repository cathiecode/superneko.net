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
		if (typeof params.streamId !== 'string') return false;
		const streamId = params.streamId;
		const stream = await this.liveStreamingService.getActive(streamId);
		if (stream == null || !await this.liveStreamingService.canView(stream, this.user ?? null)) return false;
		this.subscriber.on(`liveStream:${streamId}`, data => {
			if ((data.type === 'chatMessage' || data.type === 'chatMessageDeleted') && (this.user == null || !this.liveStreamingService.hasJoined(streamId, this.user.id))) return;
			this.send(data.type, data.body);
		});
		return true;
	}
}
