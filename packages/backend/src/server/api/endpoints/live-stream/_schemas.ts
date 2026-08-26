/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const liveStreamSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		title: { type: 'string', optional: false, nullable: false },
		visibility: { type: 'string', enum: ['followers', 'local', 'public'], optional: false, nullable: false },
		status: { type: 'string', enum: ['waiting', 'live', 'disconnected', 'ended'], optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		startedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
		disconnectedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
		user: { type: 'object', ref: 'UserLite', optional: false, nullable: false },
	},
} as const;

export const chatMessageSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		text: { type: 'string', optional: false, nullable: false },
		isAnonymous: { type: 'boolean', optional: false, nullable: false },
		user: { type: 'object', ref: 'UserLite', optional: false, nullable: true },
	},
} as const;
