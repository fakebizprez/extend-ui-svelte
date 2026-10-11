// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import Toc from './Toc.svelte';

function container(html: string) {
	const el = document.createElement('div');
	el.innerHTML = html;
	document.body.append(el);
	return el;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Toc', () => {
	it('lists h2 and h3 headings, assigning ids', async () => {
		const el = container('<h2>Usage</h2><h3>Props</h3><h2 id="x">Notes</h2>');
		render(Toc, { container: el });
		await waitFor(() => expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument());
		expect(screen.getByRole('link', { name: 'Usage' })).toHaveAttribute('href', '#usage');
		expect(screen.getByRole('link', { name: 'Props' })).toHaveAttribute('href', '#props');
		expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '#x');
		expect(el.querySelector('h2')?.id).toBe('usage');
	});

	it('renders nothing with fewer than two headings', async () => {
		const el = container('<h2>Only</h2>');
		render(Toc, { container: el });
		await Promise.resolve();
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it('re-collects when refreshKey changes', async () => {
		const el = container('<h2>A</h2><h2>B</h2>');
		const { rerender } = render(Toc, { container: el, refreshKey: '1' });
		await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
		el.innerHTML = '<h2>A</h2><h2>B</h2><h2>C</h2>';
		await rerender({ container: el, refreshKey: '2' });
		await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(3));
	});
});
