<script lang="ts">
	import { NAV_GROUPS } from './_shell/nav';
</script>

<article class="docs-prose">
	<h1>Extend UI <span class="accent">Svelte</span></h1>
	<p>
		A Svelte 5 port of <a href="https://github.com/extend-hq/ui">extend-hq/ui</a>: viewers and
		editors for PDF, DOCX, XLSX, PPTX and CSV, plus file upload, thumbnails, a file system, document
		splits, a schema builder, layout blocks, bounding-box citations, e-signature and primitives.
	</p>

	<h2 id="install">Install</h2>
	<ol>
		<li>
			Most components are a copy-in registry in the shadcn-svelte style: add one with
			<code>npx shadcn-svelte add</code> and the component's registry URL, then edit the source in
			your app.
		</li>
		<li>
			The heavy viewers and editors also ship as the <code>extend-ui-svelte</code> npm package:
			<code>bun add extend-ui-svelte</code>.
		</li>
		<li>
			Import a component from <code>extend-ui-svelte/components/&lt;name&gt;</code>. Dark mode is
			controlled by the parent through <code>isDark</code> and <code>onIsDarkChange</code>.
		</li>
	</ol>

	<h2 id="components">Components</h2>
	<div class="home-grid">
		{#each NAV_GROUPS as group (group.id)}
			<section class="home-card">
				<h3>{group.title}</h3>
				<ul>
					{#each group.items as item (item.slug)}
						<li><a href="/{item.slug}">{item.title}</a></li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<h2 id="license">License</h2>
	<p>
		MIT. Ported from <a href="https://github.com/extend-hq/ui">extend-hq/ui</a> (MIT); each ported
		component credits the upstream project in its header.
	</p>
</article>

<style>
	.home-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}
	@media (min-width: 40rem) {
		.home-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.home-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.home-card {
		min-width: 0;
		padding: 1rem;
		border: 1px solid var(--lh-border);
		border-radius: 0;
		background: var(--lh-surface);
		color: var(--lh-text);
	}
	.home-card :global(h3) {
		margin-top: 0;
	}
	.home-card ul {
		margin: 0;
		padding-left: 1.25rem;
	}
</style>
