<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :displayMyAvatar="true">
	<div class="_spacer _gaps" style="--MI_SPACER-w: 900px;">
		<MkLoading v-if="loading"/>
		<template v-else-if="stream">
			<section class="_panel" :class="$style.header">
				<div :class="$style.author"><MkAvatar :user="stream.user" :class="$style.avatar"/><div><h2>{{ stream.title }}</h2><MkUserName :user="stream.user"/></div></div>
				<span :class="$style.status"><i class="ti ti-point-filled"></i> {{ statusText }}</span>
			</section>

			<section v-if="isOwner && publishUrl" class="_panel _gaps" :class="$style.control">
				<h3>{{ howlText.broadcastControl }}</h3>
				<MkInput :modelValue="publishUrl" readonly>
					<template #label>{{ howlText.rtmpEndpoint }}</template>
				</MkInput>
				<MkInput v-if="guestUrl" :modelValue="guestUrl" readonly><template #label>{{ howlText.guestUrl }}</template></MkInput>
				<MkInput v-if="rtspUrl" :modelValue="rtspUrl" readonly><template #label>{{ howlText.rtspEndpoint }}</template></MkInput>
				<div :class="$style.actions">
					<MkButton @click="copyPublishUrl"><i class="ti ti-copy"></i> {{ i18n.ts.copy }}</MkButton>
					<MkButton danger @click="finish"><i class="ti ti-player-stop"></i> {{ howlText.end }}</MkButton>
				</div>
			</section>

			<section v-if="!joined" class="_panel _gaps" :class="$style.join">
				<h3>{{ howlText.chooseIdentity }}</h3>
				<p>{{ howlText.chooseIdentityDescription }}</p>
				<MkInput v-if="!$i" v-model="guestName"><template #label>{{ howlText.displayName }}</template></MkInput>
				<div :class="$style.actions">
					<template v-if="$i"><MkButton primary @click="join(true)">{{ howlText.joinAnonymously }}</MkButton><MkButton @click="join(false)">{{ howlText.joinWithAccount }}</MkButton></template>
					<MkButton v-else primary :disabled="!guestName.trim() || !guestToken" @click="joinGuest">{{ howlText.listen }}</MkButton>
				</div>
			</section>

			<template v-else>
				<section class="_panel" :class="$style.player">
					<video ref="videoEl" controls autoplay playsinline></video>
					<div v-if="stream.status === 'disconnected'" :class="$style.interruption">{{ howlText.temporarilyDisconnected }}</div>
				</section>
				<section v-if="$i" class="_panel _gaps" :class="$style.chat">
					<h3>{{ howlText.listeners }}</h3>
					<div :class="$style.viewerList"><span v-for="user in viewers.users" :key="user.id"><MkAvatar :user="user" :class="$style.viewerAvatar"/>{{ user.name ?? user.username }}</span><span v-for="guest in viewers.guests" :key="guest.name">{{ guest.name }} ({{ howlText.externalUser }})</span><span v-if="viewers.anonymousCount">{{ howlText.anonymousListeners(viewers.anonymousCount) }}</span></div>
				</section>

				<section v-if="$i" class="_panel _gaps" :class="$style.chat">
					<h3>{{ howlText.chat }}</h3>
					<div :class="$style.messages">
						<div v-for="message in messages" :key="message.id" :class="$style.message">
							<MkAvatar v-if="message.user" :user="message.user" :class="$style.messageAvatar"/>
							<div :class="$style.messageBody"><b>{{ message.user ? (message.user.name ?? message.user.username) : howlText.anonymous }}</b><p>{{ message.text }}</p></div>
							<button v-if="isOwner" class="_button" :aria-label="i18n.ts.delete" @click="deleteMessage(message.id)"><i class="ti ti-trash"></i></button>
						</div>
					</div>
					<MkTextarea v-model="chatText" :placeholder="howlText.chatPlaceholder" @enter="sendMessage">
						<template #label>{{ howlText.chat }}</template>
					</MkTextarea>
					<div :class="$style.chatActions"><MkSwitch v-model="chatAnonymously">{{ howlText.chatAnonymously }}</MkSwitch><MkButton primary :disabled="!chatText.trim()" @click="sendMessage">{{ i18n.ts.send }}</MkButton></div>
				</section>
			</template>
		</template>
	</div>
</PageWithHeader>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import Hls from 'hls.js';
import type * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { howlText } from '@/pages/_components/howl-text.js';

const props = defineProps<{ streamId: string }>();
const loading = ref(true);
const stream = ref<Misskey.LiveStream | null>(null);
const publishUrl = ref<string | null>(null);
const guestUrl = ref<string | null>(null);
const rtspUrl = ref<string | null>(null);
const guestToken = new URLSearchParams(window.location.search).get('guest');
const guestName = ref('');
const viewers = ref<{ anonymousCount: number; guests: { name: string; external: true }[]; users: Misskey.LiveStream['user'][] }>({ anonymousCount: 0, guests: [], users: [] });
const joined = ref(false);
const anonymous = ref(true);
const chatAnonymously = ref(false);
const chatText = ref('');
const messages = ref<Misskey.LiveStreamChatMessage[]>([]);
const videoEl = useTemplateRef('videoEl');
let hls: Hls | null = null;
let playbackRefreshTimer: number | null = null;
// The page component is recreated when the route parameter changes.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const connection = $i ? useStream().useChannel('liveStream', { streamId: props.streamId }) : null;
const isOwner = computed(() => stream.value?.user.id === $i?.id);
const statusText = computed(() => stream.value?.status === 'waiting' ? howlText.waiting : stream.value?.status === 'disconnected' ? howlText.temporarilyDisconnected : howlText.live);

async function load() {
	try { stream.value = await misskeyApi('live-stream/show', { streamId: props.streamId }); } finally { loading.value = false; }
}

async function join(asAnonymous: boolean) {
	if (!$i) return;
	anonymous.value = asAnonymous; chatAnonymously.value = asAnonymous;
	const playback = await misskeyApi('live-stream/join', { streamId: props.streamId, anonymous: asAnonymous });
	joined.value = true;
	await new Promise(resolve => window.setTimeout(resolve));
	attachPlayer(playback.playbackUrl, playback.token);
	messages.value = await misskeyApi('live-stream/chat-messages', { streamId: props.streamId });
	if (playbackRefreshTimer) window.clearInterval(playbackRefreshTimer);
	playbackRefreshTimer = window.setInterval(() => void refreshPlayback(), 4 * 60 * 1000);
}

async function joinGuest() {
	if (!guestToken || !guestName.value.trim()) return;
	const playback = await misskeyApi('live-stream/guest-join', { streamId: props.streamId, guestToken, name: guestName.value.trim() });
	joined.value = true;
	await new Promise(resolve => window.setTimeout(resolve));
	attachPlayer(playback.playbackUrl, playback.token);
}

async function refreshPlayback() {
	const playback = await misskeyApi('live-stream/join', { streamId: props.streamId, anonymous: anonymous.value });
	attachPlayer(playback.playbackUrl, playback.token);
}

function attachPlayer(url: string, token: string) {
	hls?.destroy(); hls = null;
	if (!videoEl.value) return;
	if (Hls.isSupported()) {
		hls = new Hls({ xhrSetup: xhr => xhr.setRequestHeader('Authorization', `Bearer ${token}`) });
		hls.loadSource(url); hls.attachMedia(videoEl.value);
	} else {
		videoEl.value.src = `${url}?token=${encodeURIComponent(token)}`;
	}
}

async function sendMessage() {
	const text = chatText.value.trim(); if (!text) return;
	await misskeyApi('live-stream/chat-send', { streamId: props.streamId, text, anonymous: chatAnonymously.value });
	chatText.value = '';
}

async function deleteMessage(messageId: string) { await misskeyApi('live-stream/chat-delete', { streamId: props.streamId, messageId }); }

async function finish() { const { canceled } = await os.confirm({ type: 'warning', text: howlText.endConfirm }); if (!canceled) await misskeyApi('live-stream/finish', { streamId: props.streamId }); }

function copyPublishUrl() { if (publishUrl.value) copyToClipboard(publishUrl.value); }

connection?.on('streamChanged', value => { stream.value = value; });
connection?.on('viewersChanged', value => { viewers.value = value; });
connection?.on('chatMessage', message => { messages.value.push(message); });
connection?.on('chatMessageDeleted', ({ id }) => { messages.value = messages.value.filter(message => message.id !== id); });
connection?.on('ended', () => { hls?.destroy(); joined.value = false; os.alert({ type: 'info', text: howlText.ended }); });

onMounted(async () => {
	await load();
	const stored = sessionStorage.getItem(`live-publish-url:${props.streamId}`);
	if (stored) publishUrl.value = stored;
	guestUrl.value = sessionStorage.getItem(`live-guest-url:${props.streamId}`);
	rtspUrl.value = sessionStorage.getItem(`live-rtsp-url:${props.streamId}`);
});
onBeforeUnmount(() => { hls?.destroy(); connection?.dispose(); if (playbackRefreshTimer) window.clearInterval(playbackRefreshTimer); });

const headerActions = computed(() => $i?.isModerator && !isOwner.value ? [{ icon: 'ti ti-player-stop', text: howlText.forceEnd, handler: async () => { await misskeyApi('admin/live-streams/end', { streamId: props.streamId }); } }] : []);
definePage(() => ({ title: stream.value?.title ?? howlText.title, icon: 'ti ti-broadcast' }));
</script>

<style lang="scss" module>
.header, .control, .join, .chat { padding: var(--MI-margin); }
.header { display: flex; justify-content: space-between; align-items: center; gap: var(--MI-margin); }
.author { display: flex; align-items: center; gap: var(--MI-marginHalf); min-width: 0; }
.author h2 { margin: 0; overflow: hidden; text-overflow: ellipsis; }
.avatar { width: 48px; height: 48px; }
.status { color: var(--MI_THEME-accent); white-space: nowrap; }
.actions, .chatActions { display: flex; align-items: center; justify-content: flex-end; gap: var(--MI-marginHalf); flex-wrap: wrap; }
.player { position: relative; overflow: hidden; background: var(--MI_THEME-bg); }
.player video { display: block; width: 100%; max-height: 70vh; background: var(--MI_THEME-bg); }
.interruption { position: absolute; inset: 0; display: grid; place-items: center; color: var(--MI_THEME-fg); background: color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent); }
.messages { max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.message { display: flex; align-items: flex-start; gap: var(--MI-marginHalf); }
.messageAvatar { width: 32px; height: 32px; }
.viewerList { display: flex; flex-wrap: wrap; gap: var(--MI-marginHalf); align-items: center; }
.viewerList span { display: inline-flex; align-items: center; gap: 6px; }
.viewerAvatar { width: 24px; height: 24px; }
.messageBody { flex: 1; min-width: 0; }
.messageBody p { margin: 2px 0 0; overflow-wrap: anywhere; }
</style>
