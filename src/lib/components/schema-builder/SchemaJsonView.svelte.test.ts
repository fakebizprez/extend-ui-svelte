// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { SchemaJsonView } from './index.js';
import { serializeSchema, type SchemaBuilderSchema } from './SchemaBuilder.svelte';

const SCHEMA: SchemaBuilderSchema = {
	properties: [{ id: 'a', key: 'total', type: 'number', description: 'Amount due' }]
};

describe('SchemaJsonView', () => {
	it('renders the serialized schema as formatted JSON, like upstream', () => {
		render(SchemaJsonView, { schema: SCHEMA });

		expect(screen.getByTestId('schema-builder-output').textContent).toBe(
			JSON.stringify(serializeSchema(SCHEMA), null, 2)
		);
	});

	it('follows the upstream theme prop', () => {
		render(SchemaJsonView, { schema: SCHEMA, theme: 'dark' });

		expect(screen.getByTestId('schema-builder-output')).toHaveAttribute('data-theme', 'dark');
	});

	it('resets scroll when scrollResetKey changes', async () => {
		const { rerender } = render(SchemaJsonView, { schema: SCHEMA, scrollResetKey: 0 });
		const output = screen.getByTestId('schema-builder-output');

		await rerender({ schema: SCHEMA, scrollResetKey: 0 });
		expect(screen.getByTestId('schema-builder-output')).toBe(output);

		// jsdom has no scroll layout, so assert the fresh scroller that resets it.
		await rerender({ schema: SCHEMA, scrollResetKey: 1 });
		expect(screen.getByTestId('schema-builder-output')).not.toBe(output);
	});
});
