/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, Not, QueryFailedError } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MiFollowing, MiLiveStream, MiLiveStreamChatMessage, MiUser } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import type { Packed } from '@/misc/json-schema.js';

export type PackedLiveStream = {
	id: string;
	title: string;
	status: MiLiveStream['status'];
	createdAt: string;
	startedAt: string | null;
	disconnectedAt: string | null;
	user: Packed<'UserLite'>;
};

export type PackedLiveStreamChatMessage = {
	id: string;
	createdAt: string;
	text: string;
	isAnonymous: boolean;
	user: Packed<'UserLite'> | null;
};

@Injectable()
export class LiveStreamingService {
	private disconnectTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		@Inject(DI.config) private config: Config,
		@Inject(DI.db) private db: DataSource,
		private idService: IdService,
		private globalEventService: GlobalEventService,
		private userEntityService: UserEntityService,
	) {}

	private get liveConfig() {
		if (this.config.liveStreaming == null) throw new Error('Live streaming is not configured.');
		return this.config.liveStreaming;
	}

	private hash(value: string): string {
		return createHash('sha256').update(value).digest('hex');
	}

	@bindThis
	public async pack(stream: MiLiveStream, me: MiUser | null): Promise<PackedLiveStream> {
		return {
			id: stream.id,
			title: stream.title,
			status: stream.status,
			createdAt: this.idService.parse(stream.id).date.toISOString(),
			startedAt: stream.startedAt?.toISOString() ?? null,
			disconnectedAt: stream.disconnectedAt?.toISOString() ?? null,
			user: await this.userEntityService.pack(stream.userId, me, { schema: 'UserLite' }),
		};
	}

	@bindThis
	public async packChatMessage(message: MiLiveStreamChatMessage, me: MiUser): Promise<PackedLiveStreamChatMessage> {
		return {
			id: message.id,
			createdAt: this.idService.parse(message.id).date.toISOString(),
			text: message.text,
			isAnonymous: message.isAnonymous,
			user: message.isAnonymous ? null : await this.userEntityService.pack(message.userId, me, { schema: 'UserLite' }),
		};
	}

	@bindThis
	public async create(user: MiUser, title: string): Promise<{ stream: MiLiveStream; publishToken: string }> {
		const repository = this.db.getRepository(MiLiveStream);
		if (await repository.existsBy({ userId: user.id, status: Not('ended') })) throw new Error('ACTIVE_LIVE_STREAM_EXISTS');
		const publishToken = randomBytes(24).toString('base64url');
		let stream: MiLiveStream;
		try {
			stream = await repository.save({
				id: this.idService.gen(), userId: user.id, title,
				mediaPath: `live/${randomBytes(18).toString('base64url')}`,
				publishTokenHash: this.hash(publishToken), status: 'waiting',
				startedAt: null, disconnectedAt: null, endedAt: null,
			});
		} catch (error) {
			if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') throw new Error('ACTIVE_LIVE_STREAM_EXISTS');
			throw error;
		}
		await this.notifyFollowers(stream);
		return { stream, publishToken };
	}

	@bindThis
	public async getActive(id: string): Promise<MiLiveStream | null> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ id, status: Not('ended') });
		if (stream?.status === 'disconnected' && this.isDisconnectGraceExpired(stream)) {
			await this.finish(stream.id);
			return null;
		}
		return stream;
	}

	@bindThis
	public async getFollowing(userId: string): Promise<MiLiveStream[]> {
		const followings = await this.db.getRepository(MiFollowing).findBy({ followerId: userId, followeeHost: IsNull() });
		const ids = [...new Set([userId, ...followings.map(x => x.followeeId)])];
		const streams = await this.db.getRepository(MiLiveStream).find({
			where: { userId: In(ids), status: In(['waiting', 'live', 'disconnected']) },
			order: { startedAt: 'DESC', id: 'DESC' },
		});
		const active = [];
		for (const stream of streams) {
			if (stream.status === 'disconnected' && this.isDisconnectGraceExpired(stream)) await this.finish(stream.id);
			else active.push(stream);
		}
		return active;
	}

	private isDisconnectGraceExpired(stream: MiLiveStream): boolean {
		return stream.disconnectedAt != null && stream.disconnectedAt.getTime() + this.liveConfig.disconnectGracePeriod * 1000 <= Date.now();
	}

	private signReadToken(streamId: string, userId: string): string {
		const payload = Buffer.from(JSON.stringify({ streamId, userId, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
		return `${payload}.${createHmac('sha256', this.liveConfig.tokenSecret).update(payload).digest('base64url')}`;
	}

	private verifyReadToken(token: string, streamId: string): boolean {
		const [payload, signature] = token.split('.');
		if (!payload || !signature) return false;
		const expected = createHmac('sha256', this.liveConfig.tokenSecret).update(payload).digest('base64url');
		if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
		try {
			const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { streamId: string; userId: string; exp: number };
			return data.streamId === streamId && data.exp >= Math.floor(Date.now() / 1000) && typeof data.userId === 'string';
		} catch { return false; }
	}

	@bindThis
	public async join(stream: MiLiveStream, user: MiUser, anonymous: boolean) {
		const token = this.signReadToken(stream.id, user.id);
		this.globalEventService.publishLiveStream(stream.id, 'participantJoined', anonymous ? { anonymous: true } : {
			anonymous: false, user: await this.userEntityService.pack(user.id, user, { schema: 'UserLite' }),
		});
		return { playbackUrl: `${this.liveConfig.publicUrl}/${stream.mediaPath}/index.m3u8`, token };
	}

	@bindThis
	public async authenticateMedia(action: string, path: string, token: string): Promise<boolean> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ mediaPath: path, status: Not('ended') });
		if (stream == null) return false;
		if (action === 'publish') return timingSafeEqual(Buffer.from(this.hash(token)), Buffer.from(stream.publishTokenHash));
		if (action === 'read') return this.verifyReadToken(token, stream.id);
		return false;
	}

	@bindThis
	public async mediaOnline(path: string): Promise<void> {
		const repository = this.db.getRepository(MiLiveStream);
		const stream = await repository.findOneBy({ mediaPath: path, status: Not('ended') });
		if (stream == null) return;
		const timer = this.disconnectTimers.get(stream.id);
		if (timer) clearTimeout(timer);
		this.disconnectTimers.delete(stream.id);
		stream.status = 'live'; stream.startedAt ??= new Date(); stream.disconnectedAt = null;
		await repository.save(stream); await this.publishChanged(stream);
	}

	@bindThis
	public async mediaOffline(path: string): Promise<void> {
		const repository = this.db.getRepository(MiLiveStream);
		const stream = await repository.findOneBy({ mediaPath: path, status: 'live' });
		if (stream == null) return;
		stream.status = 'disconnected'; stream.disconnectedAt = new Date();
		await repository.save(stream); await this.publishChanged(stream);
		const timer = setTimeout(() => void this.finish(stream.id), this.liveConfig.disconnectGracePeriod * 1000);
		timer.unref(); this.disconnectTimers.set(stream.id, timer);
	}

	@bindThis
	public async finish(id: string): Promise<void> {
		const repository = this.db.getRepository(MiLiveStream);
		const stream = await repository.findOneBy({ id, status: Not('ended') });
		if (stream == null) return;
		const timer = this.disconnectTimers.get(id); if (timer) clearTimeout(timer); this.disconnectTimers.delete(id);
		stream.status = 'ended'; stream.endedAt = new Date(); await repository.save(stream);
		await this.publishChanged(stream); this.globalEventService.publishLiveStream(id, 'ended', null);
		await this.kickPublisher(stream.mediaPath);
	}

	private async kickPublisher(path: string): Promise<void> {
		try {
			const apiUrl = this.liveConfig.apiUrl;
			const response = await fetch(`${apiUrl}/v3/paths/get/${encodeURIComponent(path)}`);
			if (!response.ok) return;
			const data = await response.json() as { source?: { type?: string; id?: string } };
			if (data.source?.type === 'rtmpConn' && data.source.id) await fetch(`${apiUrl}/v3/rtmpconns/kick/${encodeURIComponent(data.source.id)}`, { method: 'POST' });
		} catch { /* MediaMTX may already be disconnected. */ }
	}

	@bindThis
	public async createChatMessage(stream: MiLiveStream, user: MiUser, text: string, anonymous: boolean) {
		const message = await this.db.getRepository(MiLiveStreamChatMessage).save({
			id: this.idService.gen(), streamId: stream.id, userId: user.id, text, isAnonymous: anonymous, deletedAt: null,
		});
		const packed = await this.packChatMessage(message, user);
		this.globalEventService.publishLiveStream(stream.id, 'chatMessage', packed); return packed;
	}

	@bindThis
	public async listChatMessages(stream: MiLiveStream, user: MiUser) {
		const messages = await this.db.getRepository(MiLiveStreamChatMessage).find({
			where: { streamId: stream.id, deletedAt: IsNull() }, order: { id: 'ASC' }, take: 200,
		});
		return await Promise.all(messages.map(message => this.packChatMessage(message, user)));
	}

	@bindThis
	public async deleteChatMessage(stream: MiLiveStream, messageId: string): Promise<boolean> {
		const repository = this.db.getRepository(MiLiveStreamChatMessage);
		const message = await repository.findOneBy({ id: messageId, streamId: stream.id, deletedAt: IsNull() });
		if (message == null) return false;
		message.deletedAt = new Date(); await repository.save(message);
		this.globalEventService.publishLiveStream(stream.id, 'chatMessageDeleted', { id: message.id }); return true;
	}

	private async publishChanged(stream: MiLiveStream): Promise<void> {
		const packed = await this.pack(stream, null);
		this.globalEventService.publishLiveStream(stream.id, 'streamChanged', packed); await this.notifyFollowers(stream, packed);
	}

	private async notifyFollowers(stream: MiLiveStream, packed?: PackedLiveStream): Promise<void> {
		const followers = await this.db.getRepository(MiFollowing).findBy({ followeeId: stream.userId, followerHost: IsNull() });
		const body = packed ?? await this.pack(stream, null);
		for (const userId of new Set([stream.userId, ...followers.map(x => x.followerId)])) this.globalEventService.publishMainStream(userId, 'liveStreamChanged', body);
	}
}
