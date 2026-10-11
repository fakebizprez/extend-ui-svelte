// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import SchemaBuilder, {
	SAMPLE_SCHEMA,
	serializeSchema,
	type SchemaBuilderSchema,
	type SerializedSchema
} from './SchemaBuilder.svelte';
import { SchemaBuilderPanel } from './index.js';

const EMPTY_SCHEMA: SchemaBuilderSchema = { properties: [] };

function getFieldRows() {
	return screen.getAllByTestId('schema-builder-field');
}

describe('SchemaBuilder', () => {
	it('renders the empty state with an add-field control', () => {
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA });

		expect(screen.getByTestId('schema-builder')).toBeInTheDocument();
		expect(screen.getByTestId('schema-builder-empty')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add field' })).toBeInTheDocument();
	});

	it('adds a field and emits onSchemaChange', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, onSchemaChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));

		expect(getFieldRows()).toHaveLength(1);
		expect(onSchemaChange).toHaveBeenCalledTimes(1);
		const emitted = onSchemaChange.mock.calls[0][0] as SchemaBuilderSchema;
		expect(emitted.properties).toHaveLength(1);
		expect(emitted.properties[0].type).toBe('string');
	});

	it('editing a field key updates the emitted schema', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, onSchemaChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		const keyInput = within(getFieldRows()[0]).getByLabelText('Field key');
		await fireEvent.input(keyInput, { target: { value: 'invoiceNumber' } });

		const emitted = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(emitted.properties[0].key).toBe('invoiceNumber');
	});

	it('changing a field type updates the emitted schema', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, onSchemaChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		const typeSelect = within(getFieldRows()[0]).getByLabelText('Field type');
		await fireEvent.change(typeSelect, { target: { value: 'number' } });

		const emitted = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(emitted.properties[0].type).toBe('number');
	});

	it('supports the enum, object, and array field types', async () => {
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		const typeSelect = within(getFieldRows()[0]).getByLabelText('Field type');
		const options = within(typeSelect as HTMLElement)
			.getAllByRole('option')
			.map((o) => (o as HTMLOptionElement).value);

		for (const type of ['string', 'number', 'boolean', 'enum', 'object', 'array']) {
			expect(options).toContain(type);
		}
	});

	it('required flags are emitted in the serialized schema output event', async () => {
		const onSerializedSchemaChange = vi.fn();
		render(SchemaBuilder, {
			defaultSchema: EMPTY_SCHEMA,
			onSerializedSchemaChange
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		const row = getFieldRows()[0];
		await fireEvent.input(within(row).getByLabelText('Field key'), {
			target: { value: 'total' }
		});
		await fireEvent.change(within(row).getByLabelText('Field type'), {
			target: { value: 'number' }
		});
		await fireEvent.click(within(row).getByLabelText('Required'));

		const emitted = onSerializedSchemaChange.mock.calls.at(-1)![0] as SerializedSchema;
		expect(emitted.type).toBe('object');
		expect(emitted.properties['total']).toEqual({ type: 'number' });
		expect(emitted.required).toEqual(['total']);
	});

	it('removes a field and emits onSchemaChange', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, {
			defaultSchema: {
				properties: [
					{ id: 'a', key: 'alpha', type: 'string', description: '' },
					{ id: 'b', key: 'beta', type: 'string', description: '' }
				]
			},
			onSchemaChange
		});

		expect(getFieldRows()).toHaveLength(2);
		const rows = getFieldRows();
		await fireEvent.click(within(rows[0]).getByRole('button', { name: 'Remove field' }));

		expect(getFieldRows()).toHaveLength(1);
		const emitted = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(emitted.properties).toHaveLength(1);
		expect(emitted.properties[0].key).toBe('beta');
	});

	it('reorders fields with native drag-and-drop and emits onSchemaChange', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, {
			defaultSchema: {
				properties: [
					{ id: 'a', key: 'alpha', type: 'string', description: '' },
					{ id: 'b', key: 'beta', type: 'string', description: '' }
				]
			},
			onSchemaChange
		});

		const rows = getFieldRows();
		const dataTransfer = {
			data: {} as Record<string, string>,
			setData(format: string, value: string) {
				this.data[format] = value;
			},
			getData(format: string) {
				return this.data[format] ?? '';
			},
			effectAllowed: 'move'
		};
		await fireEvent.dragStart(rows[0], { dataTransfer });
		await fireEvent.dragOver(rows[1], { dataTransfer });
		await fireEvent.drop(rows[1], { dataTransfer });

		const emitted = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(emitted.properties.map((p) => p.key)).toEqual(['beta', 'alpha']);
	});

	it('enum fields expose editable enum values that serialize to enum + descriptions', async () => {
		const onSerializedSchemaChange = vi.fn();
		render(SchemaBuilder, {
			defaultSchema: {
				properties: [{ id: 'e', key: 'status', type: 'enum', description: '', enumValues: [] }]
			},
			onSerializedSchemaChange
		});

		const row = getFieldRows()[0];
		await fireEvent.click(within(row).getByRole('button', { name: 'Add enum value' }));
		const valueInputs = within(row).getAllByLabelText('Enum value');
		await fireEvent.input(valueInputs[0], { target: { value: 'paid' } });

		const emitted = onSerializedSchemaChange.mock.calls.at(-1)![0] as SerializedSchema;
		expect(emitted.properties['status'].enum).toEqual(['paid']);
	});

	it('switching to enum, or to array of enum, starts with one blank value like upstream', async () => {
		render(SchemaBuilder, {
			defaultSchema: {
				properties: [
					{ id: 'e', key: 'status', type: 'string', description: '' },
					{ id: 'a', key: 'tags', type: 'string', description: '' }
				]
			}
		});

		const [enumRow, arrayRow] = getFieldRows();
		await fireEvent.change(within(enumRow).getByLabelText('Field type'), {
			target: { value: 'enum' }
		});
		await fireEvent.change(within(arrayRow).getByLabelText('Field type'), {
			target: { value: 'array' }
		});
		await fireEvent.change(within(arrayRow).getByLabelText('Array item type'), {
			target: { value: 'enum' }
		});

		for (const row of getFieldRows()) {
			const values = within(row).getAllByLabelText('Enum value') as HTMLInputElement[];
			expect(values.map((input) => input.value)).toEqual(['']);
		}
	});

	it('array fields with enum items expose an enum editor whose values serialize into items', async () => {
		const onSerializedSchemaChange = vi.fn();
		render(SchemaBuilder, {
			defaultSchema: {
				properties: [{ id: 'a', key: 'tags', type: 'string', description: '' }]
			},
			onSerializedSchemaChange
		});

		const row = getFieldRows()[0];
		await fireEvent.change(within(row).getByLabelText('Field type'), {
			target: { value: 'array' }
		});
		await fireEvent.change(within(row).getByLabelText('Array item type'), {
			target: { value: 'enum' }
		});

		const editor = within(row).getByTestId('schema-builder-enum-editor');
		// One blank value is seeded on switching to enum items; add a second.
		await fireEvent.click(within(editor).getByRole('button', { name: 'Add enum value' }));
		const valueInputs = within(editor).getAllByLabelText('Enum value');
		await fireEvent.input(valueInputs[0], { target: { value: 'urgent' } });
		await fireEvent.input(valueInputs[1], { target: { value: 'billing' } });
		await fireEvent.input(within(editor).getAllByLabelText('Enum description')[0], {
			target: { value: 'Needs attention' }
		});

		const emitted = onSerializedSchemaChange.mock.calls.at(-1)![0] as SerializedSchema;
		expect(emitted.properties['tags']).toEqual({
			type: 'array',
			items: {
				type: 'string',
				enum: ['urgent', 'billing'],
				enumDescriptions: { urgent: 'Needs attention' }
			}
		});

		await fireEvent.click(within(editor).getAllByRole('button', { name: 'Remove enum value' })[0]);
		const afterRemove = onSerializedSchemaChange.mock.calls.at(-1)![0] as SerializedSchema;
		expect(afterRemove.properties['tags'].items?.enum).toEqual(['billing']);
	});

	it('shows a live JSON preview of the serialized schema', async () => {
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		await fireEvent.input(within(getFieldRows()[0]).getByLabelText('Field key'), {
			target: { value: 'vendor' }
		});

		expect(screen.getByTestId('schema-builder-output')).toHaveTextContent('"vendor"');
		expect(screen.getByTestId('schema-builder-output')).toHaveTextContent('"type": "object"');
	});

	it('controlled schema prop renders the given fields', () => {
		render(SchemaBuilder, {
			schema: {
				properties: [{ id: 'x', key: 'controlled', type: 'boolean', description: '' }]
			}
		});

		expect(getFieldRows()).toHaveLength(1);
		expect(
			within(getFieldRows()[0]).getByLabelText('Field key')
		).toHaveDisplayValue('controlled');
	});

	it('dark-mode contract: isDark sets the dark theme', () => {
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, isDark: true });

		expect(screen.getByTestId('schema-builder')).toHaveAttribute('data-theme', 'dark');
	});

	it('renders no theme toggle of its own and never flips isDark, like upstream', () => {
		const onIsDarkChange = vi.fn();
		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, isDark: false, onIsDarkChange });

		expect(screen.queryByRole('button', { name: /dark mode|light mode/i })).not.toBeInTheDocument();
		expect(screen.getByTestId('schema-builder')).toHaveAttribute('data-theme', 'light');
		expect(onIsDarkChange).not.toHaveBeenCalled();
	});

	it('accepts the upstream theme prop, which wins over isDark', () => {
		const { unmount } = render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, theme: 'dark' });
		expect(screen.getByTestId('schema-builder')).toHaveAttribute('data-theme', 'dark');
		expect(screen.getByTestId('schema-builder')).toHaveClass('dark');
		unmount();

		render(SchemaBuilder, { defaultSchema: EMPTY_SCHEMA, theme: 'light', isDark: true });
		expect(screen.getByTestId('schema-builder')).toHaveAttribute('data-theme', 'light');
	});

	it('accepts className as an alias of class on the root', () => {
		render(SchemaBuilder, {
			defaultSchema: EMPTY_SCHEMA,
			class: 'from-class',
			className: 'from-class-name'
		});

		expect(screen.getByTestId('schema-builder')).toHaveClass(
			'schema-builder',
			'from-class',
			'from-class-name'
		);
	});

	it('is exported under the upstream name SchemaBuilderPanel', () => {
		expect(SchemaBuilderPanel).toBe(SchemaBuilder);
	});

	it('defaults to the upstream sample bank-statement schema', () => {
		render(SchemaBuilder, {});

		const keys = getFieldRows().map(
			(row) => (within(row).getAllByLabelText('Field key')[0] as HTMLInputElement).value
		);
		expect(keys).toEqual(['statement_period', 'account_type', 'account_holder', 'transactions']);
		expect(SAMPLE_SCHEMA.properties.map((property) => property.key)).toEqual(keys);
		expect(serializeSchema(SAMPLE_SCHEMA).properties['transactions']).toEqual({
			type: 'array',
			description: 'Posted account activity during the statement period.',
			items: {
				type: 'object',
				properties: {
					date: { type: 'string', description: 'Posting date for the transaction.' },
					description: { type: 'string', description: 'Statement transaction description.' },
					amount: { type: 'number', description: 'Signed transaction amount.' }
				}
			}
		});
	});

	it('switching a field to array starts with object items holding one field, like upstream', async () => {
		render(SchemaBuilder, {
			defaultSchema: { properties: [{ id: 'a', key: 'lines', type: 'string', description: '' }] }
		});

		const row = getFieldRows()[0];
		await fireEvent.change(within(row).getByLabelText('Field type'), {
			target: { value: 'array' }
		});

		expect(within(row).getByLabelText('Array item type')).toHaveValue('object');
		expect(within(row).getAllByTestId('schema-builder-nested-field')).toHaveLength(1);
	});
});

describe('SchemaBuilder round-2 fixes', () => {
	it('emits plain, cloneable schemas from uncontrolled mode', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, { onSchemaChange });

		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		const nestedKey = within(getFieldRows()[2]).getAllByLabelText('Field key')[1];
		await fireEvent.input(nestedKey, { target: { value: 'owner_name' } });

		for (const [emitted] of onSchemaChange.mock.calls) {
			expect(() => structuredClone(emitted)).not.toThrow();
		}
		const last = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(last.properties[2].properties?.[0].key).toBe('owner_name');
	});

	it('controlled mode renders only what the parent passes, like upstream', async () => {
		const onSchemaChange = vi.fn();
		const schema: SchemaBuilderSchema = {
			properties: [{ id: 'x', key: 'controlled', type: 'boolean', description: '' }]
		};
		const { rerender } = render(SchemaBuilder, { schema, onSchemaChange });

		// The parent ignores the change: nothing new renders.
		await fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
		expect(onSchemaChange).toHaveBeenCalledTimes(1);
		expect(getFieldRows()).toHaveLength(1);
		await fireEvent.input(within(getFieldRows()[0]).getByLabelText('Field key'), {
			target: { value: 'rejected' }
		});
		expect(screen.getByTestId('schema-builder-output')).toHaveTextContent('"controlled"');
		expect(screen.getByTestId('schema-builder-output')).not.toHaveTextContent('"rejected"');
		// Like a React controlled input, the field itself shows the schema again.
		await tick();
		expect(within(getFieldRows()[0]).getByLabelText('Field key')).toHaveValue('controlled');
		const required = within(getFieldRows()[0]).getByLabelText('Required') as HTMLInputElement;
		await fireEvent.click(required);
		await tick();
		expect(required.checked).toBe(false);

		// The parent accepts the change: it renders.
		await rerender({ schema: onSchemaChange.mock.calls[0][0] as SchemaBuilderSchema });
		expect(getFieldRows()).toHaveLength(2);
	});

	it('serializes Required on nested object fields and array item fields', async () => {
		const onSerializedSchemaChange = vi.fn();
		render(SchemaBuilder, { onSerializedSchemaChange });

		const holder = getFieldRows()[2];
		await fireEvent.click(within(holder).getAllByLabelText('Required')[1]);
		const transactions = getFieldRows()[3];
		await fireEvent.click(within(transactions).getAllByLabelText('Required')[1]);

		const emitted = onSerializedSchemaChange.mock.calls.at(-1)![0] as SerializedSchema;
		expect(emitted.required).toBeUndefined();
		expect(emitted.properties.account_holder.required).toEqual(['name']);
		expect(emitted.properties.transactions.items?.required).toEqual(['date']);
	});

	it('every listitem is owned by a list (axe rule "listitem")', () => {
		render(SchemaBuilder, {});

		const items = screen.getAllByRole('listitem');
		expect(items.length).toBeGreaterThan(4);
		for (const item of items) {
			expect(item.parentElement?.getAttribute('role')).toBe('list');
		}
		expect(screen.getAllByRole('list')[0]).toHaveAccessibleName('Fields');
	});

	it('adds properties inside array-of-object items, like upstream', async () => {
		const onSchemaChange = vi.fn();
		render(SchemaBuilder, { onSchemaChange });

		const editor = within(getFieldRows()[3]).getByTestId('schema-builder-array-editor');
		expect(within(editor).getAllByTestId('schema-builder-nested-field')).toHaveLength(3);
		await fireEvent.click(within(editor).getByRole('button', { name: 'Add nested field' }));

		expect(within(editor).getAllByTestId('schema-builder-nested-field')).toHaveLength(4);
		const last = onSchemaChange.mock.calls.at(-1)![0] as SchemaBuilderSchema;
		expect(last.properties[3].items?.properties).toHaveLength(4);
	});
});

describe('serializeSchema', () => {
	it('serializes nested objects, arrays, and enum descriptions', () => {
		expect(
			serializeSchema({
				properties: [
					{
						id: 'o',
						key: 'address',
						type: 'object',
						description: 'Mailing address',
						required: true,
						properties: [{ id: 'c', key: 'city', type: 'string', description: '' }]
					},
					{
						id: 'arr',
						key: 'tags',
						type: 'array',
						description: '',
						items: { type: 'string' }
					},
					{
						id: 'en',
						key: 'status',
						type: 'enum',
						description: '',
						enumValues: [
							{ id: 'v1', value: 'paid', description: 'Invoice paid' },
							{ id: 'v2', value: 'open', description: '' }
						]
					}
				]
			})
		).toEqual({
			type: 'object',
			properties: {
				address: {
					type: 'object',
					description: 'Mailing address',
					properties: { city: { type: 'string' } }
				},
				tags: { type: 'array', items: { type: 'string' } },
				status: {
					type: 'string',
					enum: ['paid', 'open'],
					enumDescriptions: { paid: 'Invoice paid' }
				}
			},
			required: ['address']
		});
	});

	it('serializes required at every object level', () => {
		expect(
			serializeSchema({
				properties: [
					{
						id: 'o',
						key: 'address',
						type: 'object',
						description: '',
						properties: [
							{ id: 'c', key: 'city', type: 'string', description: '', required: true },
							{ id: 'z', key: 'zip', type: 'string', description: '' }
						]
					},
					{
						id: 'arr',
						key: 'rows',
						type: 'array',
						description: '',
						items: {
							type: 'object',
							properties: [
								{ id: 'd', key: 'date', type: 'string', description: '', required: true }
							]
						}
					}
				]
			})
		).toEqual({
			type: 'object',
			properties: {
				address: {
					type: 'object',
					properties: { city: { type: 'string' }, zip: { type: 'string' } },
					required: ['city']
				},
				rows: {
					type: 'array',
					items: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] }
				}
			}
		});
	});

	it('skips fields with blank keys', () => {
		expect(
			serializeSchema({
				properties: [{ id: 'b', key: '   ', type: 'string', description: '' }]
			})
		).toEqual({ type: 'object', properties: {} });
	});
});

describe('schema-builder docs', () => {
	it('lists every port-only export under Differences from upstream', async () => {
		const exports = Object.keys(await import('./index.js'));
		const page = (await import('../../../routes/schema-builder/+page.svelte?raw')).default as string;
		const differences = page.slice(page.indexOf('Differences from upstream'));
		const upstream = new Set(['default', 'SchemaBuilderPanel', 'SchemaJsonView', 'SAMPLE_SCHEMA', 'serializeSchema']);
		const missing = exports.filter(
			(name) => !upstream.has(name) && !differences.includes(`<code>${name}</code>`)
		);
		expect(missing).toEqual([]);
	});
});
