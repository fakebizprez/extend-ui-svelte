# Migrating from Extend UI (React) to extend-ui-svelte

This note is for teams porting an app from the React library
[`extend-hq/ui`](https://github.com/extend-hq/ui) (MIT) to this Svelte 5 port.
The port keeps the public contract wherever Svelte idioms allow; the
differences below are the ones you will actually touch during migration.

## Install

Components ship as a copy-in registry in the shadcn-svelte style, plus an
npm package for the heavy viewers and editors. Add one component at a time:

```sh
npx shadcn-svelte add <registry-url>/file-upload
```

Replace `<registry-url>` with the published registry URL for this repo.
Each item declares its `registryDependencies` (shared `dark-mode`, `utils`,
`virtual-list`, `engines`, or another component) and its npm `dependencies`,
so the CLI pulls everything the component needs. Engine packages
(`pdfjs-dist`, `docx-preview`, `xlsx`, `pptx-browser`, `pdf-lib`,
`signature_pad`, `papaparse`, `marked`, `jszip`) load on the client only via
dynamic `import()`, so no SSR guards are needed in your app.

## Prop parity

Prop names match the React versions. If you pass `isDark`,
`onIsDarkChange`, `className`, or component options such as `zoom`,
`activePage`, or `selectedPath`, the same names work here. Deliberate
renames, if any, are recorded per component in the docs site.

## Dark mode: `isDark` plus `onIsDarkChange`

Dark mode stays controlled by the parent, exactly as in React:

- The parent owns the theme state and passes it down via `isDark`.
- Components reflect it with a `dark` class on their root element
  (Tailwind class-based dark mode) and never change it themselves.
- `onIsDarkChange` is accepted for contract parity but is only invoked by
  components that render their own theme switcher control.

```svelte
<script>
	let isDark = $state(false);
</script>

<PdfViewer {isDark} onIsDarkChange={(value) => (isDark = value)} />
```

## Bindable values replace value-plus-callback pairs

Where React needs a `value` prop plus an `onChange` callback, the Svelte
port uses `$bindable` props, so plain `bind:` works:

| React | Svelte |
|---|---|
| `value` + `onChange` | `bind:value` |
| `splits` + `onSplitsChange` | `bind:splits` |
| `collapsed` + `onCollapsedChange` | `bind:collapsed` |
| `selectedPath` + `onSelectedPathChange` | `bind:selectedPath` |

```svelte
<DocumentSplits bind:splits bind:activeFieldKey />
```

Event-style notifications that are not state mirrors (file acceptance,
page changes, export, save) stay callback props with the React names:
`onFilesAccepted`, `onActivePageChange`, `onExport`, `onSave`, and so on.

## Snippets replace render props and `children`

React render props and `children` become Svelte snippets, rendered with
`{@render ...}`. Pass snippet content as component children or named
snippet props, following each component's docs page:

```svelte
<Group>
	<GroupText>Pages</GroupText>
	<GroupSeparator />
</Group>
```

Components that overlay custom UI (PDF page overlays, viewer sidebars,
toggle groups) document which snippet they accept and what data it
receives; the shape mirrors the React render-prop arguments.

## Checklist

1. Install each component with the registry command above.
2. Move theme state to the parent and pass `isDark` down.
3. Replace `value`/`onChange` pairs with `bind:`.
4. Replace render props with snippets.
5. Keep engine usage client-side: the wrappers already dynamic-import
   their libraries, but do not import engine modules in server-only code.

## Attribution

MIT License. This library is a Svelte 5 port of `extend-hq/ui` (MIT);
credit is kept in the package metadata and each ported component's header.
