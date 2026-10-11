// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PageNav from './PageNav.svelte';

const a = { slug: 'a', title: 'Alpha', description: 'd' };
const b = { slug: 'b', title: 'Beta', description: 'd' };

describe('PageNav', () => {
	it('renders both links', () => {
		render(PageNav, { prev: a, next: b });
		expect(screen.getByRole('link', { name: 'Previous: Alpha' })).toHaveAttribute('href', '/a');
		expect(screen.getByRole('link', { name: 'Next: Beta' })).toHaveAttribute('href', '/b');
	});

	it('omits an empty side', () => {
		render(PageNav, { prev: null, next: b });
		expect(screen.queryByRole('link', { name: /Previous/ })).toBeNull();
		expect(screen.getByRole('link', { name: 'Next: Beta' })).toBeInTheDocument();
	});

	it('renders nothing when both are null', () => {
		render(PageNav, { prev: null, next: null });
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('navigation')).toBeNull();
	});
});
