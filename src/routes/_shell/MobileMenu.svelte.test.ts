// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MobileMenu from './MobileMenu.svelte';

const groups = [
	{ id: 'v', title: 'Viewers', items: [{ slug: 'pdf-viewer', title: 'PDF Viewer', description: 'd' }] }
];

describe('MobileMenu', () => {
	it('renders nothing when closed', () => {
		render(MobileMenu, { open: false, groups, currentSlug: null });
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it('shows the sidebar when open', () => {
		render(MobileMenu, { open: true, groups, currentSlug: null });
		expect(screen.getByRole('link', { name: 'PDF Viewer' })).toBeInTheDocument();
	});

	it('closes on Escape', async () => {
		render(MobileMenu, { open: true, groups, currentSlug: null });
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it('closes when a link is clicked', async () => {
		render(MobileMenu, { open: true, groups, currentSlug: null });
		await fireEvent.click(screen.getByRole('link', { name: 'PDF Viewer' }));
		expect(screen.queryByRole('navigation')).toBeNull();
	});
});
