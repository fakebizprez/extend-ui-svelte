// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

const groups = [
	{ id: 'viewers', title: 'Viewers', items: [{ slug: 'pdf-viewer', title: 'PDF Viewer', description: 'd' }] },
	{ id: 'inputs', title: 'Inputs', items: [{ slug: 'file-upload', title: 'File Upload', description: 'd' }] }
];

describe('Sidebar', () => {
	it('renders a labelled nav with group headings and title links', () => {
		render(Sidebar, { groups, currentSlug: null });
		expect(screen.getByRole('navigation', { name: 'Components' })).toBeInTheDocument();
		expect(screen.getByText('Viewers')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'PDF Viewer' })).toHaveAttribute('href', '/pdf-viewer');
	});

	it('marks only the current link', () => {
		render(Sidebar, { groups, currentSlug: 'file-upload' });
		expect(screen.getByRole('link', { name: 'File Upload' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'PDF Viewer' })).not.toHaveAttribute('aria-current');
	});

	it('calls onNavigate on link click', async () => {
		const onNavigate = vi.fn();
		render(Sidebar, { groups, currentSlug: null, onNavigate });
		await fireEvent.click(screen.getByRole('link', { name: 'PDF Viewer' }));
		expect(onNavigate).toHaveBeenCalledOnce();
	});
});
