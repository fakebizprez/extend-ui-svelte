// MIT License — docs home page test. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HomePage from './+page.svelte';

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

	it('keeps installation guidance without duplicating the sidebar directory', () => {
		render(HomePage);

		expect(screen.getByRole('heading', { name: 'Install' })).toBeVisible();
		expect(screen.queryByRole('heading', { name: 'Components' })).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'PDF Viewer' })).not.toBeInTheDocument();
	});
});
