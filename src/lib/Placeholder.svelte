<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Temporary placeholder component proving the library packaging path.
	Later phases replace it with real ported components.
-->
<script lang="ts">
	interface Props {
		name?: string;
	}

	let { name = 'world' }: Props = $props();
</script>

<h1>Hello, {name}!</h1>
