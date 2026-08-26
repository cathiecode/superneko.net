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
	visibility: MiLiveStream['visibility'];
	status: MiLiveStream['status'];
	createdAt: string;
	startedAt: string | null;
	disconnectedAt: string | null;
	user: Packed<'UserLite'>;
};

type ViewerIdentity = {
	sessionId: string;
	anonymous: boolean;
	userId?: string;
	guestName?: string;
};

type ReadTokenPayload = ViewerIdentity & { streamId: string; exp: number };

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
	private waitingTimers = new Map<string, NodeJS.Timeout>();
	private pendingReaders = new Map<string, { streamId: string; identity: ViewerIdentity; timer: NodeJS.Timeout }>();
	private readers = new Map<string, Map<string, ViewerIdentity>>();

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

	private hashMatches(value: string, expectedHash: string): boolean {
		const actual = this.hash(value);
		return actual.length === expectedHash.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
	}

	@bindThis
	public async pack(stream: MiLiveStream, me: MiUser | null): Promise<PackedLiveStream> {
		return {
			id: stream.id,
			title: stream.title,
			visibility: stream.visibility,
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
	public async create(user: MiUser, title: string, visibility: MiLiveStream['visibility']): Promise<{ stream: MiLiveStream; publishToken: string; guestToken: string | null }> {
		const repository = this.db.getRepository(MiLiveStream);
		if (await repository.existsBy({ userId: user.id, status: Not('ended') })) throw new Error('ACTIVE_LIVE_STREAM_EXISTS');
		const publishToken = randomBytes(24).toString('base64url');
		const guestToken = visibility === 'public' ? randomBytes(24).toString('base64url') : null;
		let stream: MiLiveStream;
		try {
			stream = await repository.save({
				id: this.idService.gen(), userId: user.id, title,
				mediaPath: `live/${randomBytes(18).toString('base64url')}`,
				publishTokenHash: this.hash(publishToken), status: 'waiting',
				visibility, guestTokenHash: guestToken == null ? null : this.hash(guestToken),
				startedAt: null, disconnectedAt: null, endedAt: null,
			});
		} catch (error) {
			if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') throw new Error('ACTIVE_LIVE_STREAM_EXISTS');
			throw error;
		}
		await this.notifyFollowers(stream);
		this.scheduleWaitingExpiry(stream);
		return { stream, publishToken, guestToken };
	}

	@bindThis
	public async getActive(id: string): Promise<MiLiveStream | null> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ id, status: Not('ended') });
		if (stream?.status === 'disconnected' && this.isDisconnectGraceExpired(stream)) {
			await this.finish(stream.id);
			return null;
		}
		if (stream?.status === 'waiting' && this.isWaitingExpired(stream)) {
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
			else if (stream.status === 'waiting' && this.isWaitingExpired(stream)) await this.finish(stream.id);
			else active.push(stream);
		}
		return active;
	}

	private isDisconnectGraceExpired(stream: MiLiveStream): boolean {
		return stream.disconnectedAt != null && stream.disconnectedAt.getTime() + this.liveConfig.disconnectGracePeriod * 1000 <= Date.now();
	}

	private isWaitingExpired(stream: MiLiveStream): boolean {
		return stream.status === 'waiting' && this.idService.parse(stream.id).date.getTime() + this.liveConfig.waitingTimeout * 1000 <= Date.now();
	}

	private scheduleWaitingExpiry(stream: MiLiveStream): void {
		const timer = setTimeout(() => void this.finish(stream.id), this.liveConfig.waitingTimeout * 1000);
		timer.unref();
		this.waitingTimers.set(stream.id, timer);
	}

	private signReadToken(streamId: string, identity: ViewerIdentity): string {
		const payload = Buffer.from(JSON.stringify({ streamId, ...identity, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
		return `${payload}.${createHmac('sha256', this.liveConfig.tokenSecret).update(payload).digest('base64url')}`;
	}

	private verifyReadToken(token: string, streamId: string): ReadTokenPayload | null {
		const [payload, signature] = token.split('.');
		if (!payload || !signature) return null;
		const expected = createHmac('sha256', this.liveConfig.tokenSecret).update(payload).digest('base64url');
		if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
		try {
			const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ReadTokenPayload;
			return data.streamId === streamId && data.exp >= Math.floor(Date.now() / 1000) && typeof data.sessionId === 'string' ? data : null;
		} catch { return null; }
	}

	@bindThis
	public async canView(stream: MiLiveStream, user: MiUser | null): Promise<boolean> {
		if (stream.visibility === 'public') return true;
		if (user == null || user.host != null) return false;
		if (stream.visibility === 'local' || stream.userId === user.id) return true;
		return await this.db.getRepository(MiFollowing).existsBy({ followerId: user.id, followerHost: IsNull(), followeeId: stream.userId, followeeHost: IsNull() });
	}

	@bindThis
	public async join(stream: MiLiveStream, user: MiUser, anonymous: boolean) {
		const token = this.signReadToken(stream.id, { sessionId: randomBytes(12).toString('base64url'), anonymous, userId: user.id });
		return { playbackUrl: `${this.liveConfig.publicUrl}/${stream.mediaPath}/index.m3u8`, token };
	}

	@bindThis
	public async joinGuest(stream: MiLiveStream, guestToken: string, name: string) {
		if (stream.visibility !== 'public' || stream.guestTokenHash == null || !this.hashMatches(guestToken, stream.guestTokenHash)) return null;
		const token = this.signReadToken(stream.id, { sessionId: randomBytes(12).toString('base64url'), anonymous: false, guestName: name });
		return { playbackUrl: `${this.liveConfig.publicUrl}/${stream.mediaPath}/index.m3u8`, token };
	}

	@bindThis
	public async authenticateMedia(action: string, path: string, token: string, readerId?: string): Promise<boolean> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ mediaPath: path, status: Not('ended') });
		if (stream == null) return false;
		if (action === 'publish') return timingSafeEqual(Buffer.from(this.hash(token)), Buffer.from(stream.publishTokenHash));
		if (action === 'read') {
			const identity = this.verifyReadToken(token, stream.id);
			if (identity != null) {
				if (readerId) this.rememberPendingReader(readerId, stream.id, identity);
				return true;
			}
			const isPublicCapability = stream.visibility === 'public' && stream.guestTokenHash != null && this.hashMatches(token, stream.guestTokenHash);
			if (isPublicCapability && readerId) this.rememberPendingReader(readerId, stream.id, { sessionId: readerId, anonymous: true });
			return isPublicCapability;
		}
		return false;
	}

	private rememberPendingReader(readerId: string, streamId: string, identity: ViewerIdentity): void {
		const previous = this.pendingReaders.get(readerId); if (previous) clearTimeout(previous.timer);
		if (this.pendingReaders.size >= 10_000) {
			const oldestId = this.pendingReaders.keys().next().value;
			if (oldestId) { clearTimeout(this.pendingReaders.get(oldestId)!.timer); this.pendingReaders.delete(oldestId); }
		}
		const timer = setTimeout(() => this.pendingReaders.delete(readerId), 30_000); timer.unref();
		this.pendingReaders.set(readerId, { streamId, identity, timer });
	}

	@bindThis
	public async mediaOnline(path: string): Promise<void> {
		const repository = this.db.getRepository(MiLiveStream);
		const stream = await repository.findOneBy({ mediaPath: path, status: Not('ended') });
		if (stream == null) return;
		const timer = this.disconnectTimers.get(stream.id);
		if (timer) clearTimeout(timer);
		this.disconnectTimers.delete(stream.id);
		const waitingTimer = this.waitingTimers.get(stream.id); if (waitingTimer) clearTimeout(waitingTimer); this.waitingTimers.delete(stream.id);
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
		const waitingTimer = this.waitingTimers.get(id); if (waitingTimer) clearTimeout(waitingTimer); this.waitingTimers.delete(id);
		this.readers.delete(id);
		for (const [readerId, pending] of this.pendingReaders) if (pending.streamId === id) { clearTimeout(pending.timer); this.pendingReaders.delete(readerId); }
		stream.status = 'ended'; stream.endedAt = new Date(); await repository.save(stream);
		await this.publishChanged(stream); this.globalEventService.publishLiveStream(id, 'ended', null);
		await this.kickPublisher(stream.mediaPath);
	}

	@bindThis
	public async readerOnline(path: string, readerId: string): Promise<void> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ mediaPath: path, status: Not('ended') });
		if (stream == null || !readerId) return;
		const pending = this.pendingReaders.get(readerId);
		const identity = pending?.identity ?? { sessionId: readerId, anonymous: true };
		if (pending) clearTimeout(pending.timer); this.pendingReaders.delete(readerId);
		const streamReaders = this.readers.get(stream.id) ?? new Map<string, ViewerIdentity>();
		streamReaders.set(readerId, identity); this.readers.set(stream.id, streamReaders);
		await this.publishViewers(stream.id);
	}

	@bindThis
	public async readerOffline(path: string, readerId: string): Promise<void> {
		const stream = await this.db.getRepository(MiLiveStream).findOneBy({ mediaPath: path });
		if (stream == null) return;
		this.readers.get(stream.id)?.delete(readerId);
		await this.publishViewers(stream.id);
	}

	private async publishViewers(streamId: string): Promise<void> {
		const identities = [...(this.readers.get(streamId)?.values() ?? [])];
		const unique = [...new Map(identities.map(identity => [identity.sessionId, identity])).values()];
		const anonymousCount = unique.filter(identity => identity.anonymous).length;
		const guests = unique.filter(identity => !identity.anonymous && identity.guestName).map(identity => ({ id: identity.sessionId, name: identity.guestName!, external: true as const }));
		const userIds = [...new Set(unique.filter(identity => !identity.anonymous && identity.userId).map(identity => identity.userId!))];
		const users = await Promise.all(userIds.map(userId => this.userEntityService.pack(userId, null, { schema: 'UserLite' })));
		this.globalEventService.publishLiveStream(streamId, 'viewersChanged', { anonymousCount, guests, users });
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
