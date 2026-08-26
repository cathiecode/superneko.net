/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiLiveStream } from './LiveStream.js';
import { MiUser } from './User.js';

@Entity('live_stream_chat_message')
export class MiLiveStreamChatMessage {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({ ...id() })
	public streamId: MiLiveStream['id'];

	@ManyToOne(() => MiLiveStream, { onDelete: 'CASCADE' })
	@JoinColumn()
	public stream: MiLiveStream | null;

	@Index()
	@Column({ ...id() })
	public userId: MiUser['id'];

	@ManyToOne(() => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', { length: 1000 })
	public text: string;

	@Column('boolean', { default: false })
	public isAnonymous: boolean;

	@Column('timestamp with time zone', { nullable: true })
	public deletedAt: Date | null;
}
