// MIT License — docs home page test. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import HomePage from './+page.svelte';
import { NAV_GROUPS } from './_shell/nav';

describe('docs home page', () => {
	it('renders the title, upstream link and license', () => {
		render(HomePage);

		expect(screen.getByRole('heading', { level: 1, name: 'Extend UI Svelte' })).toBeVisible();
		for (const link of screen.getAllByRole('link', { name: 'extend-hq/ui' })) {
			expect(link).toHaveAttribute('href', 'https://github.com/extend-hq/ui');
		}
		expect(screen.getByRole('heading', { name: 'License' })).toBeVisible();
		expect(screen.getAllByText(/MIT/).length).toBeGreaterThan(0);
	});

	it('renders one card per nav group linking every component', () => {
		render(HomePage);

		for (const group of NAV_GROUPS) {
			const card = screen.getByRole('heading', { name: group.title }).closest('section')!;
			for (const item of group.items) {
				expect(within(card).getByRole('link', { name: item.title })).toHaveAttribute(
					'href',
					`/${item.slug}`
				);
			}
		}
	});
});
