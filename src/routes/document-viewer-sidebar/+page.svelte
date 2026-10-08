<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Docs preview for the document-viewer-sidebar component.
-->
<script lang="ts">
	import DocumentViewerSidebar from '#lib/components/document-viewer-sidebar/DocumentViewerSidebar.svelte';
	import type { DocumentViewerSidebarSection } from '#lib/components/document-viewer-sidebar/DocumentViewerSidebar.svelte';

	const sections: DocumentViewerSidebarSection[] = [
		{
			id: 'navigate',
			title: 'Navigate',
			items: [
				{ id: 'thumbnails', label: 'Thumbnails' },
				{ id: 'outline', label: 'Outline' }
			]
		},
		{
			id: 'tools',
			title: 'Tools',
			items: [
				{ id: 'search', label: 'Search' },
				{ id: 'annotate', label: 'Annotate', disabled: true }
			]
		}
	];

	let activeItemId: string | null = $state('thumbnails');
	let collapsed = $state(false);
	let isDark = $state(false);
</script>

<h1>Document Viewer Sidebar</h1>
<p>
	Active item: <code>{activeItemId ?? 'none'}</code>
	| Collapsed: <code>{collapsed}</code>
	| Dark mode: <code>{isDark}</code>
</p>

<DocumentViewerSidebar
	{sections}
	bind:activeItemId
	bind:collapsed
	bind:isDark
	onActiveItemChange={(id) => (activeItemId = id)}
	onCollapsedChange={(value) => (collapsed = value)}
	onIsDarkChange={(value) => (isDark = value)}
/>

<p><a href="/">Back to all components</a></p>
