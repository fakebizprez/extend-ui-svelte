// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Header from './Header.svelte';

describe('Header', () => {
	it('offers a skip link before repeated navigation', () => {
		render(Header);
		expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
	});

	it('renders home link, GitHub link and theme toggle', () => {
		render(Header);
		expect(screen.getByRole('link', { name: /extend ui/i })).toHaveAttribute('href', '/');
		const gh = screen.getByRole('link', { name: /github/i });
		expect(gh).toHaveAttribute('href', 'https://github.com/extend-hq/ui');
		expect(gh.getAttribute('rel')).toContain('noopener');
		expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
	});

	it('menu button toggles aria-expanded', async () => {
		render(Header);
		const menu = screen.getByRole('button', { name: 'Menu' });
		expect(menu).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(menu);
		expect(menu).toHaveAttribute('aria-expanded', 'true');
	});
});
