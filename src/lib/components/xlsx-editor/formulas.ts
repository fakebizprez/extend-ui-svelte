// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Local formula engine for the XLSX editor: A1 references, ranges, basic
// arithmetic, and SUM/AVERAGE/MIN/MAX/COUNT/PRODUCT. Pure and framework-free.

/** A raw grid value: literals plus `=...` formula strings. */
export type CellValue = string | number | boolean | null;

/** Reads a raw grid value by zero-based row/column. Out-of-grid reads return undefined. */
export type CellGetter = (row: number, col: number) => CellValue | undefined;

export interface CellCoord {
	row: number;
	col: number;
}

const REF_PATTERN = /^([A-Za-z]+)([1-9][0-9]*)$/;

/** Converts column letters (A, Z, AA, ...) to a zero-based index. */
export function columnLetterToIndex(letters: string): number {
	let index = 0;
	for (const char of letters.toUpperCase()) {
		index = index * 26 + (char.charCodeAt(0) - 64);
	}
	return index - 1;
}

/** Converts a zero-based column index to letters (0 -> A, 26 -> AA). */
export function columnIndexToLetter(index: number): string {
	let letters = '';
	let rest = index;
	do {
		letters = String.fromCharCode(65 + (rest % 26)) + letters;
		rest = Math.floor(rest / 26) - 1;
	} while (rest >= 0);
	return letters;
}

/** Parses an A1 reference to zero-based coordinates, or null when malformed. */
export function parseCellRef(ref: string): CellCoord | null {
	const match = REF_PATTERN.exec(ref.trim());
	if (!match) return null;
	return { row: Number(match[2]) - 1, col: columnLetterToIndex(match[1]) };
}

/** Expands an A1:B2 range into every coordinate it covers, or null when malformed. */
export function expandRange(range: string): CellCoord[] | null {
	const parts = range.split(':');
	if (parts.length !== 2) return null;
	const start = parseCellRef(parts[0] ?? '');
	const end = parseCellRef(parts[1] ?? '');
	if (!start || !end) return null;
	const top = Math.min(start.row, end.row);
	const bottom = Math.max(start.row, end.row);
	const left = Math.min(start.col, end.col);
	const right = Math.max(start.col, end.col);
	const coords: CellCoord[] = [];
	for (let row = top; row <= bottom; row += 1) {
		for (let col = left; col <= right; col += 1) {
			coords.push({ row, col });
		}
	}
	return coords;
}

class FormulaError extends Error {
	readonly code: string;

	constructor(code: string) {
		super(code);
		this.code = code;
	}
}

function toNumber(value: CellValue | undefined): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	const trimmed = value.trim();
	if (trimmed === '') return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function toDisplayString(value: CellValue | undefined): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

/** Coerces an arithmetic operand: blanks and missing cells are 0, text is #VALUE!. */
function toOperand(value: CellValue | undefined): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === 'string' && value.trim() === '') return 0;
	const numeric = toNumber(value);
	if (numeric === null) throw new FormulaError('#VALUE!');
	return numeric;
}

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'string'; value: string }
	| { kind: 'ident'; value: string }
	| { kind: 'op'; value: string }
	| { kind: 'lparen' }
	| { kind: 'rparen' }
	| { kind: 'comma' }
	| { kind: 'colon' };

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < input.length) {
		const char = input[i] as string;
		if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
			i += 1;
			continue;
		}
		if (char === '"') {
			let value = '';
			i += 1;
			while (i < input.length && input[i] !== '"') {
				if (input[i] === '"' && input[i + 1] === '"') {
					value += '"';
					i += 2;
				} else {
					value += input[i];
					i += 1;
				}
			}
			if (input[i] !== '"') throw new FormulaError('#ERROR');
			i += 1;
			tokens.push({ kind: 'string', value });
			continue;
		}
		if ((char >= '0' && char <= '9') || (char === '.' && i + 1 < input.length && (input[i + 1] as string) >= '0' && (input[i + 1] as string) <= '9')) {
			const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(input.slice(i));
			if (!match) throw new FormulaError('#ERROR');
			tokens.push({ kind: 'number', value: Number(match[0]) });
			i += match[0].length;
			continue;
		}
		if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || char === '_' || char === '$') {
			const match = /^\$?[A-Za-z_]+\$?[0-9]*/.exec(input.slice(i));
			if (!match) throw new FormulaError('#ERROR');
			tokens.push({ kind: 'ident', value: match[0].replaceAll('$', '') });
			i += match[0].length;
			continue;
		}
		if (char === '(') {
			tokens.push({ kind: 'lparen' });
			i += 1;
			continue;
		}
		if (char === ')') {
			tokens.push({ kind: 'rparen' });
			i += 1;
			continue;
		}
		if (char === ',') {
			tokens.push({ kind: 'comma' });
			i += 1;
			continue;
		}
		if (char === ':') {
			tokens.push({ kind: 'colon' });
			i += 1;
			continue;
		}
		if ('+-*/%^&'.includes(char)) {
			tokens.push({ kind: 'op', value: char });
			i += 1;
			continue;
		}
		throw new FormulaError('#ERROR');
	}
	return tokens;
}

class Parser {
	private pos = 0;

	constructor(
		private readonly tokens: Token[],
		private readonly resolveRef: (ref: string) => CellValue
	) {}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	private next(): Token | undefined {
		return this.tokens[this.pos++];
	}

	private expectCommaOrRparen(): Token {
		const token = this.next();
		if (!token || (token.kind !== 'comma' && token.kind !== 'rparen')) {
			throw new FormulaError('#ERROR');
		}
		return token;
	}

	parseExpression(): CellValue {
		return this.parseConcat();
	}

	private parseConcat(): CellValue {
		let left = this.parseAdditive();
		while (this.peek()?.kind === 'op' && (this.peek() as { value: string }).value === '&') {
			this.next();
			const right = this.parseAdditive();
			left = toDisplayString(left) + toDisplayString(right);
		}
		return left;
	}

	private parseAdditive(): CellValue {
		let left = this.parseMultiplicative();
		for (;;) {
			const token = this.peek();
			if (token?.kind !== 'op' || (token.value !== '+' && token.value !== '-')) return left;
			this.next();
			const right = this.parseMultiplicative();
			left = token.value === '+' ? toOperand(left) + toOperand(right) : toOperand(left) - toOperand(right);
		}
	}

	private parseMultiplicative(): CellValue {
		let left = this.parsePower();
		for (;;) {
			const token = this.peek();
			if (token?.kind !== 'op' || (token.value !== '*' && token.value !== '/')) return left;
			this.next();
			const right = this.parsePower();
			const divisor = toOperand(right);
			if (token.value === '/') {
				if (divisor === 0) throw new FormulaError('#DIV/0!');
				left = toOperand(left) / divisor;
			} else {
				left = toOperand(left) * divisor;
			}
		}
	}

	private parsePower(): CellValue {
		const base = this.parseUnary();
		const token = this.peek();
		if (token?.kind === 'op' && token.value === '^') {
			this.next();
			return Math.pow(toOperand(base), toOperand(this.parseUnary()));
		}
		return base;
	}

	private parseUnary(): CellValue {
		const token = this.peek();
		if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
			this.next();
			const operand = toOperand(this.parseUnary());
			return token.value === '-' ? -operand : operand;
		}
		return this.parsePostfix();
	}

	private parsePostfix(): CellValue {
		let value = this.parsePrimary();
		while (this.peek()?.kind === 'op' && (this.peek() as { value: string }).value === '%') {
			this.next();
			value = toOperand(value) / 100;
		}
		return value;
	}

	private parsePrimary(): CellValue {
		const token = this.next();
		if (!token) throw new FormulaError('#ERROR');
		if (token.kind === 'number') return token.value;
		if (token.kind === 'string') return token.value;
		if (token.kind === 'lparen') {
			const value = this.parseExpression();
			const closing = this.next();
			if (!closing || closing.kind !== 'rparen') throw new FormulaError('#ERROR');
			return value;
		}
		if (token.kind === 'ident') {
			if (this.peek()?.kind === 'lparen') {
				this.next();
				return this.parseFunctionCall(token.value);
			}
			if (parseCellRef(token.value)) return this.resolveRef(token.value);
			throw new FormulaError('#NAME?');
		}
		throw new FormulaError('#ERROR');
	}

	private parseFunctionCall(name: string): CellValue {
		const values: CellValue[] = [];
		const closing = this.peek();
		if (closing?.kind === 'rparen') {
			this.next();
			return applyFunction(name, values);
		}
		for (;;) {
			values.push(...this.parseArgument());
			const separator = this.expectCommaOrRparen();
			if (separator.kind === 'rparen') return applyFunction(name, values);
		}
	}

	private parseArgument(): CellValue[] {
		// A range argument (A1:B2) is only valid here, never in bare arithmetic.
		const first = this.peek();
		const second = this.tokens[this.pos + 1];
		if (
			first?.kind === 'ident' &&
			second?.kind === 'colon' &&
			parseCellRef(first.value)
		) {
			this.next();
			this.next();
			const end = this.next();
			if (end?.kind !== 'ident' || !parseCellRef(end.value)) throw new FormulaError('#ERROR');
			const coords = expandRange(`${first.value}:${end.value}`);
			if (!coords) throw new FormulaError('#ERROR');
			return coords.map((coord) => this.resolveRef(columnIndexToLetter(coord.col) + String(coord.row + 1)));
		}
		return [this.parseConcat()];
	}

	expectEnd(): void {
		if (this.pos < this.tokens.length) throw new FormulaError('#ERROR');
	}
}

function applyFunction(name: string, values: CellValue[]): CellValue {
	const numerics: number[] = [];
	for (const value of values) {
		const numeric = toNumber(value);
		if (numeric !== null) numerics.push(numeric);
	}
	switch (name.toUpperCase()) {
		case 'SUM':
			return numerics.reduce((total, value) => total + value, 0);
		case 'AVERAGE':
			if (numerics.length === 0) throw new FormulaError('#DIV/0!');
			return numerics.reduce((total, value) => total + value, 0) / numerics.length;
		case 'MIN':
			return numerics.length === 0 ? 0 : Math.min(...numerics);
		case 'MAX':
			return numerics.length === 0 ? 0 : Math.max(...numerics);
		case 'COUNT':
			return numerics.length;
		case 'PRODUCT':
			return numerics.length === 0 ? 0 : numerics.reduce((total, value) => total * value, 1);
		default:
			throw new FormulaError('#NAME?');
	}
}

/**
 * Evaluates one raw grid value. Plain values pass through; strings starting
 * with `=` are evaluated as formulas against `get`. Errors surface as
 * Excel-style strings (#DIV/0!, #NAME?, #CIRC!, #VALUE!, #ERROR).
 */
export function evaluateCell(
	raw: CellValue | undefined,
	get: CellGetter,
	seen: ReadonlySet<string> = new Set()
): CellValue {
	if (typeof raw !== 'string' || !raw.startsWith('=')) {
		return raw === undefined ? null : raw;
	}
	const expression = raw.slice(1).trim();
	if (expression === '') return '#ERROR';
	try {
		const resolveRef = (ref: string): CellValue => {
			const coord = parseCellRef(ref);
			if (!coord) throw new FormulaError('#NAME?');
			const key = `${coord.row}:${coord.col}`;
			if (seen.has(key)) throw new FormulaError('#CIRC!');
			const value = get(coord.row, coord.col);
			if (typeof value === 'string' && value.startsWith('=')) {
				return evaluateCell(value, get, new Set(seen).add(key));
			}
			// Missing cells read as 0, matching spreadsheet behavior.
			return value === undefined ? 0 : value;
		};
		const parser = new Parser(tokenize(expression), resolveRef);
		const value = parser.parseExpression();
		parser.expectEnd();
		if (typeof value === 'number' && !Number.isFinite(value)) {
			throw new FormulaError('#DIV/0!');
		}
		return value;
	} catch (failure) {
		if (failure instanceof FormulaError) return failure.code;
		throw failure;
	}
}
