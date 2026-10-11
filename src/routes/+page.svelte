<article class="docs-prose">
	<h1>Extend UI <span class="accent">Svelte</span></h1>
	<p>
		A Svelte 5 port of <a href="https://github.com/extend-hq/ui">extend-hq/ui</a>: viewers and
		editors for PDF, DOCX, XLSX, PPTX and CSV, plus file upload, thumbnails, a file system, document
		splits, a schema builder, layout blocks, bounding-box citations, e-signature and primitives.
	</p>

	<h2 id="install">Install</h2>
	<ol>
		<li>
			Most components are a copy-in registry in the shadcn-svelte style: add one with
			<code>npx shadcn-svelte add</code> and the component's registry URL, then edit the source in
			your app.
		</li>
		<li>
			The heavy viewers and editors also ship as the <code>extend-ui-svelte</code> npm package:
			<code>bun add extend-ui-svelte</code>.
		</li>
		<li>
			Import a component from <code>extend-ui-svelte/components/&lt;name&gt;</code>. Dark mode is
			controlled by the parent through <code>isDark</code> and <code>onIsDarkChange</code>.
		</li>
	</ol>

	<h2 id="license">License</h2>
	<p>
		MIT. Ported from <a href="https://github.com/extend-hq/ui">extend-hq/ui</a> (MIT); each ported
		component credits the upstream project in its header.
	</p>
</article>
