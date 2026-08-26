/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lang } from '@@/js/config.js';

const en = {
	title: 'Superneko Howl', create: 'Start a Howl', streamTitle: 'Howl title', waiting: 'Waiting for stream', live: 'Live',
	temporarilyDisconnected: 'Stream paused', broadcastControl: 'Howl controls', rtmpEndpoint: 'RTMP publishing URL', rtspEndpoint: 'RTSP viewing URL',
	guestUrl: 'Public guest URL', end: 'End Howl', endConfirm: 'End this Howl?', ended: 'This Howl has ended', forceEnd: 'Force end Howl',
	chooseIdentity: 'Choose how to listen', chooseIdentityDescription: 'Choose whether to show your account in the listener list.',
	joinAnonymously: 'Listen anonymously', joinWithAccount: 'Listen with account', anonymous: 'Anonymous', anonymousListeners: (n: number) => `+ ${n} anonymous listeners`,
	externalUser: 'External user', displayName: 'Display name', listen: 'Listen', listeners: 'Listeners', chat: 'Howl chat', chatPlaceholder: 'Write a message',
	chatAnonymously: 'Post anonymously', visibility: 'Visibility', followers: 'Followers only', local: 'Superneko users only', public: 'Public',
	publicDescription: 'Anyone with the guest URL can watch. External viewers cannot see or use chat.', noFollowingStreams: 'No followed users are Howling.',
} as const;

const ja = {
	title: 'すーぱーねこ Howl', create: 'Howlを開始', streamTitle: '配信タイトル', waiting: '配信待機中', live: '配信中',
	temporarilyDisconnected: '配信停止中', broadcastControl: 'Howlコントロール', rtmpEndpoint: 'RTMP配信エンドポイント', rtspEndpoint: 'RTSP視聴URL',
	guestUrl: '外部視聴用URL', end: 'Howlを終了', endConfirm: 'このHowlを終了しますか？', ended: 'Howlは終了しました', forceEnd: 'Howlを強制終了',
	chooseIdentity: 'リスニング方法を選択', chooseIdentityDescription: '視聴者一覧にアカウントを表示するか選べます。',
	joinAnonymously: '匿名で参加', joinWithAccount: 'アカウントを表示して参加', anonymous: '匿名', anonymousListeners: (n: number) => `+ ${n}人の匿名参加者`,
	externalUser: '外部ユーザー', displayName: '表示名', listen: '視聴する', listeners: '視聴者', chat: 'Howlチャット', chatPlaceholder: 'メッセージを入力',
	chatAnonymously: '匿名で発言', visibility: '公開範囲', followers: 'フォロワー限定', local: 'すーぱーねこのユーザーのみ', public: '全公開',
	publicDescription: '外部視聴用URLを知っている人は視聴できます。外部ユーザーはチャットを閲覧・投稿できません。', noFollowingStreams: 'フォロー中のHowlはありません。',
};
export const howlText = lang.startsWith('ja') ? ja : en;
