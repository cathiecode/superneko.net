/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onUnmounted, Ref } from 'vue';
import * as Misskey from 'misskey-js';
import { useStream } from '@/stream.js';
import { $i } from '@/account.js';

export function useNoteCapture(props: {
	rootEl: Ref<HTMLElement>;
	note: Ref<Misskey.entities.Note>;
	isDeletedRef: Ref<boolean>;
}) {
	const note = props.note;
	const connection = $i ? useStream() : null;

	function onStreamNoteUpdated(noteData): void {
		const { type, id, body } = noteData;

		if (id !== note.value.id) return;

		switch (type) {
			case 'reacted': {
				const reaction = body.reaction;

				if (body.emoji && !(body.emoji.name in note.value.reactionEmojis)) {
					note.value.reactionEmojis[body.emoji.name] = body.emoji.url;
				}

				// TODO: reactionsプロパティがない場合ってあったっけ？ なければ || {} は消せる
				const currentCount = (note.value.reactions || {})[reaction] || 0;

				note.value.reactions[reaction] = currentCount + 1;

				if ($i && (body.userId === $i.id)) {
					note.value.myReaction = reaction;
				}
				break;
			}

			case 'unreacted': {
				const reaction = body.reaction;

				// TODO: reactionsプロパティがない場合ってあったっけ？ なければ || {} は消せる
				const currentCount = (note.value.reactions || {})[reaction] || 0;

				note.value.reactions[reaction] = Math.max(0, currentCount - 1);
				if (note.value.reactions[reaction] === 0) delete note.value.reactions[reaction];

				if ($i && (body.userId === $i.id)) {
					note.value.myReaction = null;
				}
				break;
			}

			case 'pollVoted': {
				const choice = body.choice;

				const choices = [...note.value.poll.choices];
				choices[choice] = {
					...choices[choice],
					votes: choices[choice].votes + 1,
					...($i && (body.userId === $i.id) ? {
						isVoted: true,
					} : {}),
				};

				note.value.poll.choices = choices;
				break;
			}

			case 'updated': {
				note.value.updatedAt = new Date().toISOString();
				note.value.cw = body.cw;
				note.value.text = body.text;
				break;
			}

			case 'deleted': {
				props.isDeletedRef.value = true;
				break;
			}
		}
	}

	function capture(withHandler = false): void {
		if (connection) {
			// TODO: このノートがストリーミング経由で流れてきた場合のみ sr する
			connection.send(document.body.contains(props.rootEl.value) ? 'sr' : 's', { id: note.value.id });
			if (withHandler) connection.on('noteUpdated', onStreamNoteUpdated);
		}
	}

	function decapture(withHandler = false): void {
		if (connection) {
			connection.send('un', {
				id: note.value.id,
			});
			if (withHandler) connection.off('noteUpdated', onStreamNoteUpdated);
		}
	}

	function onStreamConnected() {
		capture(false);
	}

	capture(true);
	if (connection) {
		connection.on('_connected_', onStreamConnected);
	}

	onUnmounted(() => {
		decapture(true);
		if (connection) {
			connection.off('_connected_', onStreamConnected);
		}
	});
}
