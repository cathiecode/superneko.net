<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer _gaps" style="--MI_SPACER-w: 700px;">
		<section class="_panel _gaps" :class="$style.form">
			<MkInput v-model="title"><template #label>{{ howlText.streamTitle }}</template></MkInput>
			<MkRadios v-model="visibility" :options="[
				{ value: 'followers', label: howlText.followers },
				{ value: 'local', label: howlText.local },
				{ value: 'public', label: howlText.public },
			]">
				<template #label>{{ howlText.visibility }}</template>
			</MkRadios>
			<p v-if="visibility === 'public'">{{ howlText.publicDescription }}</p>
			<MkButton primary :disabled="!title.trim()" @click="create"><i class="ti ti-broadcast"></i> {{ howlText.create }}</MkButton>
		</section>
	</div>
</PageWithHeader>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkRadios from '@/components/MkRadios.vue';
import { howlText } from '@/pages/_components/howl-text.js';
import { definePage } from '@/page.js';
import * as os from '@/os.js';

const title = ref('');
const visibility = ref<'followers' | 'local' | 'public'>('local');

async function create() {
	const created = await os.apiWithDialog('live-stream/create', { title: title.value.trim(), visibility: visibility.value });
	sessionStorage.setItem(`live-publish-url:${created.stream.id}`, created.publishUrl);
	if (created.guestUrl) sessionStorage.setItem(`live-guest-url:${created.stream.id}`, created.guestUrl);
	if (created.rtspUrl) sessionStorage.setItem(`live-rtsp-url:${created.stream.id}`, created.rtspUrl);
	os.pageWindow(`/live/${created.stream.id}`);
}

definePage(() => ({ title: howlText.title, icon: 'ti ti-broadcast' }));
</script>

<style lang="scss" module>
.form { padding: var(--MI-margin); }
.form p { margin: 0; color: var(--MI_THEME-fgTransparentWeak); }
</style>
