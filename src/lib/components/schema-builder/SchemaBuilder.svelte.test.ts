// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it, vi } from 'vitest';
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

	it('skips fields with blank keys', () => {
		expect(
			serializeSchema({
				properties: [{ id: 'b', key: '   ', type: 'string', description: '' }]
			})
		).toEqual({ type: 'object', properties: {} });
	});
});
