// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Pure validator for the docs site llms.txt files. Returns a list of
// human-readable problems; an empty list means the document is valid.

const ENTRY_PATTERN = /^- \[([^\]]+)\]\(([^)]+)\)(?::(.*))?$/;

/** Check an llms.txt document against the required format. Pure. */
export function validateLlmsTxt(content: string): string[] {
	const errors: string[] = [];
	const lines = content.split('\n');

	const first = lines[0]?.trim() ?? '';
	if (!/^# [^#]/.test(first)) {
		errors.push('Missing H1 title on the first line.');
	}

	const quote = lines.find((line, index) => index > 0 && line.startsWith('> '));
	if (quote === undefined) {
		errors.push('Missing blockquote description after the title.');
	} else {
		const description = quote.slice(2);
		if (description.trim().length === 0) {
			errors.push('Description blockquote is empty.');
		} else if (description.length > 200) {
			errors.push(
				`Description is ${description.length} characters; keep it under 200.`
			);
		}
	}

	if (!lines.some((line) => line.startsWith('## '))) {
		errors.push('Document needs at least one H2 section.');
	}

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('- [')) continue;
		const match = ENTRY_PATTERN.exec(trimmed);
		if (!match) {
			errors.push(`Malformed entry: ${trimmed}`);
			continue;
		}
		const [, title, url, description] = match;
		if (!/^https?:\/\//.test(url)) {
			errors.push(`Entry "${title}" URL must be absolute, got: ${url}`);
		}
		if (description === undefined || description.trim().length === 0) {
			errors.push(`Entry "${title}" is missing a description after the link.`);
		}
	}

	return errors;
}
