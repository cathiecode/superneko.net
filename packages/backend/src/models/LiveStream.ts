/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('live_stream')
@Index('IDX_live_stream_active_user', ['userId'], { unique: true, where: '"status" <> \'ended\'' })
export class MiLiveStream {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({ ...id() })
	public userId: MiUser['id'];

	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 200 })
	public title: string;

	@Index({ unique: true })
	@Column('varchar', { length: 128 })
	public mediaPath: string;

	@Column('varchar', { length: 64 })
	public publishTokenHash: string;

	@Column('varchar', { length: 16, default: 'followers' })
	public visibility: 'followers' | 'public';

	@Column('varchar', { length: 64, nullable: true })
	public guestTokenHash: string | null;

	@Index()
	@Column('varchar', { length: 32, default: 'waiting' })
	public status: 'waiting' | 'live' | 'disconnected' | 'ended';

	@Column('timestamp with time zone', { nullable: true })
	public startedAt: Date | null;

	@Column('timestamp with time zone', { nullable: true })
	public disconnectedAt: Date | null;

	@Column('timestamp with time zone', { nullable: true })
	public endedAt: Date | null;
}
