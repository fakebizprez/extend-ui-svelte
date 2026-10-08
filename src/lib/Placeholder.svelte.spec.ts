import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Placeholder from './Placeholder.svelte';

describe('Placeholder', () => {
	it('renders a greeting for the given name', () => {
		render(Placeholder, { name: 'Svelte' });

		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, Svelte!');
	});

	it('falls back to the default name', () => {
		render(Placeholder);

		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, world!');
	});
});
