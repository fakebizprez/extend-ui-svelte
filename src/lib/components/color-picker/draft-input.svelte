<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Internal text field ported from the DraftInput helper in
	apps/v4/components/ui/color-picker.tsx: keeps an editing draft, commits on
	blur or Enter, reverts on Escape, and steps numerics on ArrowUp/ArrowDown.
	Not part of the public API. The upstream focus-reselect and copy affordances
	are omitted (see ColorPicker.svelte).
-->
<script lang="ts">
	interface DraftInputProps {
		value: string;
		onCommitText: (text: string) => void;
		onStep?: (direction: 1 | -1, big: boolean) => void;
		disabled?: boolean;
		inputMode?: 'decimal' | 'text';
		class?: string;
		[key: string]: unknown;
	}

	let {
		value,
		onCommitText,
		onStep,
		disabled = false,
		inputMode = 'text',
		class: className = '',
		...rest
	}: DraftInputProps = $props();

	let draft = $state<string | null>(null);

	function commit() {
		if (draft !== null && draft.trim() !== value) onCommitText(draft);
		draft = null;
	}
</script>

<input
	type="text"
	autocomplete="off"
	autocorrect="off"
	spellcheck={false}
	{...rest}
	class={className}
	{disabled}
	inputmode={inputMode}
	value={draft ?? value}
	onfocus={(event) => {
		draft = event.currentTarget.value;
		event.currentTarget.select();
	}}
	oninput={(event) => {
		draft = event.currentTarget.value;
	}}
	onblur={commit}
	onkeydown={(event) => {
		if (event.key === 'Enter') {
			commit();
		} else if (event.key === 'Escape') {
			if (draft !== null) {
				event.stopPropagation();
				draft = null;
			}
		} else if (onStep && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			event.preventDefault();
			draft = null;
			onStep(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
		}
	}}
/>
