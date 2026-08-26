/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lang } from '@@/js/config.js';

const en = {
	title: 'Howl', create: 'Start a Howl', streamTitle: 'Howl title', waiting: 'Waiting for stream', live: 'Live',
	temporarilyDisconnected: 'Stream paused', broadcastControl: 'Manage Howl', rtmpEndpoint: 'RTMP publishing URL', rtspEndpoint: 'RTSP viewing URL',
	obsGuide: 'Use these settings in OBS.', obsServer: 'Server', obsStreamKey: 'Stream key', resync: 'Resync', play: 'Play', mute: 'Mute', unmute: 'Unmute',
	guestUrl: 'Public guest URL', copyPublishUrl: 'Copy RTMP publishing URL', copyGuestUrl: 'Copy public URL', copyRtspUrl: 'Copy RTSP URL', share: 'Share Howl', sharePost: (title: string, url: string) => `${title} is live on Superneko. Watch it now.\n${url}`, end: 'End Howl', endConfirm: 'End this Howl?', ended: 'This Howl has ended', forceEnd: 'Force end Howl',
	chooseIdentity: 'Watch', chooseIdentityDescription: 'Choose whether to show your account in the listener list.',
	joinAnonymously: 'Listen anonymously', joinWithAccount: 'Listen with account', anonymous: 'Anonymous', anonymousListeners: (n: number) => `+ ${n} anonymous listeners`,
	externalUser: 'External user', displayName: 'Display name', listen: 'Listen', listeners: 'Listeners', chat: 'Howl chat', chatPlaceholder: 'Write a message',
	chatAnonymously: 'Post anonymously', visibility: 'Visibility', followers: 'Followers only', public: 'Public',
	publicDescription: 'Anyone with the viewing URL can watch. Superneko users can read and post chat messages. RTSP viewing is enabled.',
	followersDescription: 'Superneko users who follow you can watch the stream.',
	loadFailed: 'This Howl is unavailable or has ended.', playerLabel: 'Howl video player',
	notificationType: 'A followed user starts a Howl', notificationStarted: (name: string) => `${name} started a Howl`,
} as const;

const ja = {
	title: 'Howl', create: 'Howlを開始', streamTitle: '配信タイトル', waiting: '配信待機中', live: '配信中',
	temporarilyDisconnected: '配信停止中', broadcastControl: 'Howlの管理', rtmpEndpoint: 'RTMP配信エンドポイント', rtspEndpoint: 'RTSP視聴URL',
	obsGuide: 'OBSでは設定は以下のように設定します。', obsServer: 'サーバー', obsStreamKey: 'ストリームキー', resync: 'Resync', play: '再生', mute: 'ミュート', unmute: 'ミュート解除',
	guestUrl: '外部視聴用URL', copyPublishUrl: 'RTMP配信エンドポイントをコピー', copyGuestUrl: '外部視聴用URLをコピー', copyRtspUrl: 'RTSP URLをコピー', share: 'Howlを共有', sharePost: (title: string, url: string) => `${title} をすーぱーねこで配信中。今すぐ見ろ。\n${url}`, end: 'Howlを終了', endConfirm: 'このHowlを終了しますか？', ended: 'Howlは終了しました', forceEnd: 'Howlを強制終了',
	chooseIdentity: '視聴する', chooseIdentityDescription: '視聴者一覧にアカウントを表示するか選べます。',
	joinAnonymously: '匿名で参加', joinWithAccount: 'アカウントを表示して参加', anonymous: '匿名', anonymousListeners: (n: number) => `+ ${n}人の匿名参加者`,
	externalUser: '外部ユーザー', displayName: '表示名', listen: '視聴する', listeners: '視聴者', chat: 'Howlチャット', chatPlaceholder: 'メッセージを入力',
	chatAnonymously: '匿名で発言', visibility: '公開範囲', followers: 'フォロワー限定', public: '全公開',
	followersDescription: 'あなたをフォローしているすーぱーねこのユーザーが配信を視聴できます。',
	publicDescription: '視聴用URLを知っている人が視聴できます。すーぱーねこのユーザーはチャットを閲覧・投稿できます。RTSPでの視聴も有効になります。',
	loadFailed: 'このHowlは利用できないか、終了しました。', playerLabel: 'Howl動画プレイヤー',
	notificationType: 'フォロー中のユーザーがHowlを開始', notificationStarted: (name: string) => `${name}がHowlを開始しました`,
};
export const howlText = lang.startsWith('ja') ? ja : en;
