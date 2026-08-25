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
				<h3>{{ i18n.ts._liveStreaming.broadcastControl }}</h3>
				<MkInput :modelValue="publishUrl" readonly>
					<template #label>{{ i18n.ts._liveStreaming.rtmpEndpoint }}</template>
				</MkInput>
				<div :class="$style.actions">
					<MkButton @click="copyPublishUrl"><i class="ti ti-copy"></i> {{ i18n.ts.copy }}</MkButton>
					<MkButton danger @click="finish"><i class="ti ti-player-stop"></i> {{ i18n.ts._liveStreaming.end }}</MkButton>
				</div>
			</section>

			<section v-if="!joined" class="_panel _gaps" :class="$style.join">
				<h3>{{ i18n.ts._liveStreaming.chooseIdentity }}</h3>
				<p>{{ i18n.ts._liveStreaming.chooseIdentityDescription }}</p>
				<div :class="$style.actions">
					<MkButton primary @click="join(true)">{{ i18n.ts._liveStreaming.joinAnonymously }}</MkButton>
					<MkButton @click="join(false)">{{ i18n.ts._liveStreaming.joinWithAccount }}</MkButton>
				</div>
			</section>

			<template v-else>
				<section class="_panel" :class="$style.player">
					<video ref="videoEl" controls autoplay playsinline></video>
					<div v-if="stream.status === 'disconnected'" :class="$style.interruption">{{ i18n.ts._liveStreaming.temporarilyDisconnected }}</div>
				</section>

				<section class="_panel _gaps" :class="$style.chat">
					<h3>{{ i18n.ts._liveStreaming.chat }}</h3>
					<div :class="$style.messages">
						<div v-for="message in messages" :key="message.id" :class="$style.message">
							<MkAvatar v-if="message.user" :user="message.user" :class="$style.messageAvatar"/>
							<div :class="$style.messageBody"><b>{{ message.user ? (message.user.name ?? message.user.username) : i18n.ts._liveStreaming.anonymous }}</b><p>{{ message.text }}</p></div>
							<button v-if="isOwner" class="_button" :aria-label="i18n.ts.delete" @click="deleteMessage(message.id)"><i class="ti ti-trash"></i></button>
						</div>
					</div>
					<MkTextarea v-model="chatText" :placeholder="i18n.ts._liveStreaming.chatPlaceholder" @enter="sendMessage">
						<template #label>{{ i18n.ts._liveStreaming.chat }}</template>
					</MkTextarea>
					<div :class="$style.chatActions"><MkSwitch v-model="chatAnonymously">{{ i18n.ts._liveStreaming.chatAnonymously }}</MkSwitch><MkButton primary :disabled="!chatText.trim()" @click="sendMessage">{{ i18n.ts.send }}</MkButton></div>
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
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import * as os from '@/os.js';

const props = defineProps<{ streamId: string }>();
const $i = ensureSignin();
const loading = ref(true);
const stream = ref<Misskey.LiveStream | null>(null);
const publishUrl = ref<string | null>(null);
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
const connection = useStream().useChannel('liveStream', { streamId: props.streamId });
const isOwner = computed(() => stream.value?.user.id === $i.id);
const statusText = computed(() => stream.value?.status === 'waiting' ? i18n.ts._liveStreaming.waiting : stream.value?.status === 'disconnected' ? i18n.ts._liveStreaming.temporarilyDisconnected : i18n.ts._liveStreaming.live);

async function load() {
	try { stream.value = await misskeyApi('live-stream/show', { streamId: props.streamId }); } finally { loading.value = false; }
}

async function join(asAnonymous: boolean) {
	anonymous.value = asAnonymous; chatAnonymously.value = asAnonymous;
	const playback = await misskeyApi('live-stream/join', { streamId: props.streamId, anonymous: asAnonymous });
	joined.value = true;
	await new Promise(resolve => window.setTimeout(resolve));
	attachPlayer(playback.playbackUrl, playback.token);
	messages.value = await misskeyApi('live-stream/chat-messages', { streamId: props.streamId });
	if (playbackRefreshTimer) window.clearInterval(playbackRefreshTimer);
	playbackRefreshTimer = window.setInterval(() => void refreshPlayback(), 4 * 60 * 1000);
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

async function finish() { const { canceled } = await os.confirm({ type: 'warning', text: i18n.ts._liveStreaming.endConfirm }); if (!canceled) await misskeyApi('live-stream/finish', { streamId: props.streamId }); }

function copyPublishUrl() { if (publishUrl.value) copyToClipboard(publishUrl.value); }

connection.on('streamChanged', value => { stream.value = value; });
connection.on('chatMessage', message => { messages.value.push(message); });
connection.on('chatMessageDeleted', ({ id }) => { messages.value = messages.value.filter(message => message.id !== id); });
connection.on('ended', () => { hls?.destroy(); joined.value = false; os.alert({ type: 'info', text: i18n.ts._liveStreaming.ended }); });

onMounted(async () => {
	await load();
	const stored = sessionStorage.getItem(`live-publish-url:${props.streamId}`);
	if (stored) publishUrl.value = stored;
});
onBeforeUnmount(() => { hls?.destroy(); connection.dispose(); if (playbackRefreshTimer) window.clearInterval(playbackRefreshTimer); });

const headerActions = computed(() => $i.isModerator && !isOwner.value ? [{ icon: 'ti ti-player-stop', text: i18n.ts._liveStreaming.forceEnd, handler: async () => { await misskeyApi('admin/live-streams/end', { streamId: props.streamId }); } }] : []);
definePage(() => ({ title: stream.value?.title ?? i18n.ts._liveStreaming.title, icon: 'ti ti-broadcast' }));
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
.messageBody { flex: 1; min-width: 0; }
.messageBody p { margin: 2px 0 0; overflow-wrap: anywhere; }
</style>
