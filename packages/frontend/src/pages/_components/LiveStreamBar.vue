<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<section v-if="$i" :class="$style.root" class="_panel">
	<div :class="$style.header">
		<strong><i class="ti ti-broadcast"></i> {{ i18n.ts._liveStreaming.title }}</strong>
		<MkButton small primary @click="createStream"><i class="ti ti-plus"></i> {{ i18n.ts._liveStreaming.create }}</MkButton>
	</div>
	<div v-if="streams.length" :class="$style.streams">
		<button v-for="stream in streams" :key="stream.id" class="_button" :class="$style.stream" @click="os.pageWindow(`/live/${stream.id}`)">
			<MkAvatar :user="stream.user" :class="$style.avatar"/>
			<span :class="$style.text"><b>{{ stream.title }}</b><small>{{ stream.user.name ?? stream.user.username }}</small></span>
			<span :class="$style.live"><i class="ti ti-point-filled"></i> {{ stream.status === 'waiting' ? i18n.ts._liveStreaming.waiting : i18n.ts._liveStreaming.live }}</span>
		</button>
	</div>
	<div v-else :class="$style.empty">{{ i18n.ts._liveStreaming.noFollowingStreams }}</div>
</section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type * as Misskey from 'misskey-js';
import MkButton from '@/components/MkButton.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';

const streams = ref<Misskey.LiveStream[]>([]);
const connection = $i ? useStream().useChannel('main') : null;

async function reload() {
	streams.value = await misskeyApi('live-stream/following', {});
}

async function createStream() {
	const { canceled, result } = await os.form(i18n.ts._liveStreaming.create, {
		title: { type: 'string', label: i18n.ts._liveStreaming.streamTitle },
	});
	if (canceled || !result.title.trim()) return;
	const created = await os.apiWithDialog('live-stream/create', { title: result.title.trim() });
	sessionStorage.setItem(`live-publish-url:${created.stream.id}`, created.publishUrl);
	os.pageWindow(`/live/${created.stream.id}`);
}

onMounted(() => {
	void reload();
	connection?.on('liveStreamChanged', reload);
});
onBeforeUnmount(() => connection?.dispose());
</script>

<style lang="scss" module>
.root { margin-bottom: var(--MI-margin); padding: var(--MI-margin); }
.header { display: flex; align-items: center; justify-content: space-between; gap: var(--MI-marginHalf); }
.streams { display: flex; gap: var(--MI-marginHalf); overflow-x: auto; margin-top: var(--MI-margin); }
.stream { display: flex; align-items: center; min-width: 260px; gap: var(--MI-marginHalf); padding: var(--MI-marginHalf); border: solid 1px var(--MI_THEME-divider); border-radius: var(--MI-radius); text-align: left; }
.avatar { width: 42px; height: 42px; }
.text { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.text b, .text small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text small, .empty { color: var(--MI_THEME-fgTransparentWeak); }
.live { color: var(--MI_THEME-accent); font-size: 0.85em; white-space: nowrap; }
.empty { margin-top: var(--MI-marginHalf); font-size: 0.9em; }
</style>
