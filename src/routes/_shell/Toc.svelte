<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	type Heading = { id: string; text: string; level: number };

	let { container, refreshKey = '' }: { container: HTMLElement | null; refreshKey?: string } =
		$props();

	let headings = $state<Heading[]>([]);
	let activeId = $state('');

	function slugify(text: string) {
		return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	$effect(() => {
		void refreshKey;
		if (!container) {
			headings = [];
			return;
		}
		const used = new Set<string>();
		const els = [...container.querySelectorAll<HTMLElement>('h2, h3')];
		for (const el of els) if (el.id) used.add(el.id);
		const next = els.map((el) => {
			const text = el.textContent?.trim() ?? '';
			if (!el.id) {
				const base = slugify(text) || 'section';
				let id = base;
				for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
				used.add(id);
				el.id = id;
			}
			return { id: el.id, text, level: el.tagName === 'H3' ? 3 : 2 };
		});
		headings = next;
		activeId = next[0]?.id ?? '';

		if (typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				const hit = entries.find((e) => e.isIntersecting);
				if (hit) activeId = hit.target.id;
			},
			{ rootMargin: '0px 0px -70% 0px' }
		);
		els.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	});
</script>

{#if headings.length >= 2}
	<nav aria-label="On this page">
		<h2>On this page</h2>
		<ul>
			{#each headings as h (h.id)}
				<li class:nested={h.level === 3}>
					<a href="#{h.id}" aria-current={h.id === activeId ? 'location' : undefined}>{h.text}</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	h2 {
		margin: 0 0 0.5rem;
		font-family: var(--lh-mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--lh-muted);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nested {
		padding-left: 0.75rem;
	}
	a {
		display: block;
		min-height: 24px;
		box-sizing: border-box;
		padding: 0.25rem 0;
		font-family: var(--lh-mono);
		font-size: 0.6875rem;
		color: var(--lh-muted);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a:hover {
		color: var(--lh-text);
	}
	a[aria-current='location'] {
		color: var(--lh-blue);
		font-weight: 700;
	}
	a:focus-visible {
		outline: 2px solid var(--lh-blue);
		outline-offset: 2px;
	}
</style>
