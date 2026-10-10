<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	DocumentViewerSidebar: layout-only sidebar shell for document viewers.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface DocumentViewerSidebarItem {
		id: string;
		label: string;
		disabled?: boolean;
	}

	export interface DocumentViewerSidebarSection {
		id: string;
		title: string;
		items: DocumentViewerSidebarItem[];
	}

	interface Props {
		sections?: DocumentViewerSidebarSection[];
		activeItemId?: string | null;
		onActiveItemChange?: (id: string) => void;
		collapsed?: boolean;
		onCollapsedChange?: (collapsed: boolean) => void;
		isDark?: boolean;
		onIsDarkChange?: (isDark: boolean) => void;
		children?: Snippet;
	}

	let {
		sections = [],
		activeItemId = $bindable(null),
		onActiveItemChange,
		collapsed = $bindable(false),
		onCollapsedChange,
		isDark = $bindable(false),
		onIsDarkChange,
		children
	}: Props = $props();

	function selectItem(item: DocumentViewerSidebarItem): void {
		if (item.disabled) return;
		activeItemId = item.id;
		onActiveItemChange?.(item.id);
	}

	function toggleCollapsed(): void {
		collapsed = !collapsed;
		onCollapsedChange?.(collapsed);
	}

	function toggleDark(): void {
		isDark = !isDark;
		onIsDarkChange?.(isDark);
	}
</script>

<aside
	data-testid="document-viewer-sidebar"
	data-collapsed={collapsed ? 'true' : 'false'}
	data-theme={isDark ? 'dark' : 'light'}
>
	<div>
		<button type="button" aria-expanded={!collapsed} onclick={toggleCollapsed}>
			{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		</button>
		<button type="button" aria-pressed={isDark} onclick={toggleDark}>
			{isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		</button>
	</div>

	{#if !collapsed}
		<nav aria-label="Document viewer">
			{#each sections as section (section.id)}
				<section aria-labelledby={`sidebar-section-${section.id}`}>
					<h2 id={`sidebar-section-${section.id}`}>{section.title}</h2>
					<ul>
						{#each section.items as item (item.id)}
							<li>
								<button
									type="button"
									disabled={item.disabled}
									aria-current={activeItemId === item.id ? 'true' : undefined}
									onclick={() => selectItem(item)}
								>
									{item.label}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</nav>
		{#if children}
			{@render children()}
		{/if}
	{/if}
</aside>
