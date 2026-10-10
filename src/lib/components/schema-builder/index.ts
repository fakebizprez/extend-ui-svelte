// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type SchemaBuilder from './SchemaBuilder.svelte';

export { default as SchemaBuilder } from './SchemaBuilder.svelte';
/** Upstream React export name. */
export { default as SchemaBuilderPanel } from './SchemaBuilder.svelte';
export { default } from './SchemaBuilder.svelte';
export {
	createSchemaBuilderEnumValue,
	createSchemaBuilderId,
	createSchemaBuilderProperty,
	normalizePropertyForType,
	SAMPLE_SCHEMA,
	SCHEMA_BUILDER_ARRAY_ITEM_TYPES,
	SCHEMA_BUILDER_FIELD_TYPES,
	serializeSchema
} from './SchemaBuilder.svelte';
export type {
	SchemaBuilderArrayItemType,
	SchemaBuilderArrayScalarType,
	SchemaBuilderEnumValue,
	SchemaBuilderFieldType,
	SchemaBuilderProperty,
	SchemaBuilderScalarType,
	SchemaBuilderSchema,
	SchemaBuilderTheme,
	SerializedSchema,
	SerializedSchemaProperty
} from './SchemaBuilder.svelte';
export type SchemaBuilderProps = ComponentProps<typeof SchemaBuilder>;
