/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { LiveStreamingService } from '@/core/LiveStreamingService.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckExpiredHowlsProcessorService {
	private logger: Logger;

	constructor(
		private liveStreamingService: LiveStreamingService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('check-expired-howls');
	}

	@bindThis
	public async process(): Promise<void> {
		const count = await this.liveStreamingService.finishExpired();
		if (count > 0) this.logger.info(`Finished ${count} expired Howl(s).`);
	}
}
