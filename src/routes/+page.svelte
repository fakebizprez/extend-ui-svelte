<script lang="ts">
	import { PREVIEW_COMPONENTS } from './components';
</script>

<h1>Extend UI Svelte</h1>
<p>
	Svelte 5 port of <a href="https://github.com/extend-hq/ui">extend-hq/ui</a>. Each component gets a
	live preview page below as it is ported.
</p>
<ul>
	{#each PREVIEW_COMPONENTS as component (component.slug)}
		<li><a href="/{component.slug}">{component.title}</a></li>
	{/each}
</ul>
