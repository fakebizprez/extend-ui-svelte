// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Local formula engine for the XLSX editor: A1 references, ranges, basic
// arithmetic, TRUE/FALSE, and SUM/AVERAGE/MIN/MAX/COUNT/PRODUCT with Excel's
// argument rules. Pure and framework-free.
import { XlsxCellError } from '#lib/engines/xlsx/xlsx.js';

/** A cell value: text, number, boolean, blank (null), or an error such as #DIV/0!. */
export type CellValue = string | number | boolean | null | XlsxCellError;

/** Reads a cell value by zero-based row/column. Out-of-grid reads return undefined. */
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

/** An Excel error raised while evaluating; it becomes the cell's value. */
class FormulaError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}

/**
 * Raised for formulas this engine cannot compute (unknown functions,
 * comparisons, cross-sheet references, syntax it does not parse). Callers fall
 * back to the file's saved value, or #NAME?.
 */
class UnsupportedFormula extends Error {}

const SUPPORTED_FUNCTIONS = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'PRODUCT']);

/** Number for a value typed directly into a formula: booleans and numeric text count. */
function toNumber(value: CellValue | undefined): number | null {
	if (value === null || value === undefined || value instanceof XlsxCellError) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	const trimmed = value.trim();
	if (trimmed === '') return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: CellValue | undefined): string {
	if (value instanceof XlsxCellError) throw new FormulaError(value.code);
	if (value === null || value === undefined) return '';
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
	return String(value);
}

/** Coerces an arithmetic operand: blanks are 0, errors propagate, other text is #VALUE!. */
function toOperand(value: CellValue | undefined): number {
	if (value instanceof XlsxCellError) throw new FormulaError(value.code);
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
			while (i < input.length) {
				if (input[i] === '"' && input[i + 1] === '"') {
					value += '"';
					i += 2;
				} else if (input[i] === '"') {
					break;
				} else {
					value += input[i];
					i += 1;
				}
			}
			if (input[i] !== '"') throw new UnsupportedFormula();
			i += 1;
			tokens.push({ kind: 'string', value });
			continue;
		}
		if ((char >= '0' && char <= '9') || (char === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
			const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(input.slice(i));
			if (!match) throw new UnsupportedFormula();
			tokens.push({ kind: 'number', value: Number(match[0]) });
			i += match[0].length;
			continue;
		}
		if (/[A-Za-z_$]/.test(char)) {
			const match = /^\$?[A-Za-z_]+\$?[0-9]*/.exec(input.slice(i));
			if (!match) throw new UnsupportedFormula();
			tokens.push({ kind: 'ident', value: match[0].replaceAll('$', '') });
			i += match[0].length;
			continue;
		}
		if (char === '(') tokens.push({ kind: 'lparen' });
		else if (char === ')') tokens.push({ kind: 'rparen' });
		else if (char === ',') tokens.push({ kind: 'comma' });
		else if (char === ':') tokens.push({ kind: 'colon' });
		else if ('+-*/%^&'.includes(char)) tokens.push({ kind: 'op', value: char });
		// Comparisons, sheet references (!), and anything else are not handled here.
		else throw new UnsupportedFormula();
		i += 1;
	}
	return tokens;
}

/** A function argument: a reference (range or single cell) or a typed-in value. */
type Argument = { ref: true; values: CellValue[] } | { ref: false; value: CellValue };

class Parser {
	private pos = 0;

	constructor(
		private readonly tokens: Token[],
		private readonly resolve: (coord: CellCoord) => CellValue
	) {}

	private peek(offset = 0): Token | undefined {
		return this.tokens[this.pos + offset];
	}

	private next(): Token | undefined {
		return this.tokens[this.pos++];
	}

	private isOp(value: string): boolean {
		const token = this.peek();
		return token?.kind === 'op' && token.value === value;
	}

	parseExpression(): CellValue {
		let left = this.parseAdditive();
		while (this.isOp('&')) {
			this.next();
			const right = this.parseAdditive();
			left = toText(left) + toText(right);
		}
		return left;
	}

	private parseAdditive(): CellValue {
		let left = this.parseMultiplicative();
		while (this.isOp('+') || this.isOp('-')) {
			const op = (this.next() as { value: string }).value;
			const right = this.parseMultiplicative();
			left = op === '+' ? toOperand(left) + toOperand(right) : toOperand(left) - toOperand(right);
		}
		return left;
	}

	private parseMultiplicative(): CellValue {
		let left = this.parsePower();
		while (this.isOp('*') || this.isOp('/')) {
			const op = (this.next() as { value: string }).value;
			const right = toOperand(this.parsePower());
			if (op === '*') {
				left = toOperand(left) * right;
			} else {
				const dividend = toOperand(left);
				if (right === 0) throw new FormulaError('#DIV/0!');
				left = dividend / right;
			}
		}
		return left;
	}

	private parsePower(): CellValue {
		const base = this.parseUnary();
		if (!this.isOp('^')) return base;
		this.next();
		return Math.pow(toOperand(base), toOperand(this.parseUnary()));
	}

	private parseUnary(): CellValue {
		if (this.isOp('-') || this.isOp('+')) {
			const op = (this.next() as { value: string }).value;
			const operand = toOperand(this.parseUnary());
			return op === '-' ? -operand : operand;
		}
		let value = this.parsePrimary();
		while (this.isOp('%')) {
			this.next();
			value = toOperand(value) / 100;
		}
		return value;
	}

	private parsePrimary(): CellValue {
		const token = this.next();
		if (!token) throw new UnsupportedFormula();
		if (token.kind === 'number' || token.kind === 'string') return token.value;
		if (token.kind === 'lparen') {
			const value = this.parseExpression();
			if (this.next()?.kind !== 'rparen') throw new UnsupportedFormula();
			return value;
		}
		if (token.kind === 'ident') {
			if (this.peek()?.kind === 'lparen') {
				this.next();
				return this.parseFunctionCall(token.value.toUpperCase());
			}
			const upper = token.value.toUpperCase();
			if (upper === 'TRUE' || upper === 'FALSE') return upper === 'TRUE';
			const coord = parseCellRef(token.value);
			if (coord) return this.resolve(coord);
		}
		throw new UnsupportedFormula();
	}

	private parseFunctionCall(name: string): CellValue {
		if (!SUPPORTED_FUNCTIONS.has(name)) throw new UnsupportedFormula();
		const args: Argument[] = [];
		if (this.peek()?.kind === 'rparen') {
			this.next();
			return applyFunction(name, args);
		}
		for (;;) {
			args.push(this.parseArgument());
			const separator = this.next();
			if (separator?.kind === 'rparen') return applyFunction(name, args);
			if (separator?.kind !== 'comma') throw new UnsupportedFormula();
		}
	}

	private parseArgument(): Argument {
		const first = this.peek();
		const second = this.peek(1);
		if (first?.kind === 'ident' && parseCellRef(first.value)) {
			// A range (A1:B2) or a bare reference (A1) gets reference semantics.
			if (second?.kind === 'colon') {
				this.next();
				this.next();
				const end = this.next();
				const coords =
					end?.kind === 'ident' ? expandRange(`${first.value}:${end.value}`) : null;
				if (!coords) throw new UnsupportedFormula();
				return { ref: true, values: coords.map((coord) => this.resolve(coord)) };
			}
			if (second?.kind === 'comma' || second?.kind === 'rparen') {
				this.next();
				return { ref: true, values: [this.resolve(parseCellRef(first.value) as CellCoord)] };
			}
		}
		return { ref: false, value: this.parseExpression() };
	}

	expectEnd(): void {
		if (this.pos < this.tokens.length) throw new UnsupportedFormula();
	}
}

/**
 * Excel's rules: inside references only numbers count (text, booleans, and
 * blanks are skipped); typed-in arguments also count booleans and numeric
 * text, and other text is #VALUE!. Errors propagate, except in COUNT.
 */
function applyFunction(name: string, args: Argument[]): CellValue {
	const counting = name === 'COUNT';
	const numbers: number[] = [];
	const take = (value: CellValue, direct: boolean) => {
		if (value instanceof XlsxCellError) {
			if (!counting) throw new FormulaError(value.code);
			return;
		}
		if (typeof value === 'number') {
			numbers.push(value);
			return;
		}
		if (!direct || value === null) return;
		const numeric = toNumber(value);
		if (numeric !== null) numbers.push(numeric);
		else if (!counting) throw new FormulaError('#VALUE!');
	};
	for (const arg of args) {
		if (arg.ref) arg.values.forEach((value) => take(value, false));
		else take(arg.value, true);
	}
	const sum = () => numbers.reduce((total, value) => total + value, 0);
	switch (name) {
		case 'SUM':
			return sum();
		case 'AVERAGE':
			if (numbers.length === 0) throw new FormulaError('#DIV/0!');
			return sum() / numbers.length;
		case 'MIN':
			return numbers.length === 0 ? 0 : Math.min(...numbers);
		case 'MAX':
			return numbers.length === 0 ? 0 : Math.max(...numbers);
		case 'COUNT':
			return numbers.length;
		default:
			return numbers.length === 0 ? 0 : numbers.reduce((total, value) => total * value, 1);
	}
}

const UNSUPPORTED = Symbol('unsupported');

/** Evaluates formula text (without `=`); UNSUPPORTED when this engine cannot. */
function evaluateFormula(
	formula: string,
	resolve: (coord: CellCoord) => CellValue
): CellValue | typeof UNSUPPORTED {
	try {
		const parser = new Parser(tokenize(formula), resolve);
		const value = parser.parseExpression();
		parser.expectEnd();
		if (typeof value === 'number' && !Number.isFinite(value)) return new XlsxCellError('#DIV/0!');
		// A formula pointing at a blank cell shows 0, as in Excel.
		return value ?? 0;
	} catch (failure) {
		if (failure instanceof FormulaError) return new XlsxCellError(failure.code);
		if (failure instanceof UnsupportedFormula) return UNSUPPORTED;
		throw failure;
	}
}

interface Bounds {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

/** Cells a formula reads, as rectangles; empty when it cannot be parsed. */
function referencedBounds(formula: string): Bounds[] {
	let tokens: Token[];
	try {
		tokens = tokenize(formula);
	} catch {
		return [];
	}
	const bounds: Bounds[] = [];
	tokens.forEach((token, index) => {
		if (token.kind !== 'ident' || tokens[index + 1]?.kind === 'lparen') return;
		if (tokens[index - 1]?.kind === 'colon') return;
		const start = parseCellRef(token.value);
		if (!start) return;
		const endToken = tokens[index + 1]?.kind === 'colon' ? tokens[index + 2] : undefined;
		const end = (endToken?.kind === 'ident' && parseCellRef(endToken.value)) || start;
		bounds.push({
			top: Math.min(start.row, end.row),
			bottom: Math.max(start.row, end.row),
			left: Math.min(start.col, end.col),
			right: Math.max(start.col, end.col)
		});
	});
	return bounds;
}

/** One sheet's cells as the evaluator reads them. */
export interface SheetCells {
	/** Literal value; for a formula cell, the result saved in the file (if any). */
	value: CellGetter;
	/** Formula text without the leading `=`, or undefined for a literal cell. */
	formula: (row: number, col: number) => string | undefined;
	/** Keys (`row:col`) of every formula cell; read only when `edited` is non-empty. */
	formulaKeys?: () => Iterable<string>;
	/** Keys (`row:col`) of cells changed since load. */
	edited?: ReadonlySet<string>;
}

function keyToCoord(key: string): CellCoord {
	const [row, col] = key.split(':').map(Number) as [number, number];
	return { row, col };
}

/**
 * Returns a function giving each cell's value as a spreadsheet shows it.
 * Formula cells show the file's saved value until the cell or one of its
 * inputs (directly or through other formulas) is edited; then they are
 * recalculated locally. Formulas this engine cannot compute keep the saved
 * value, or show #NAME? when there is none. Results are cached, so create a
 * new evaluator after any change.
 */
export function createSheetEvaluator(cells: SheetCells): (row: number, col: number) => CellValue {
	const edited = cells.edited ?? new Set<string>();
	const values = new Map<string, CellValue>();
	const dirty = new Map<string, boolean>();
	let formulaCoords: CellCoord[] | null = null;
	const editedCoords = [...edited].map(keyToCoord);

	function dependsOnEdit(row: number, col: number, visiting: Set<string>): boolean {
		const key = `${row}:${col}`;
		if (edited.has(key)) return true;
		if (edited.size === 0) return false;
		const known = dirty.get(key);
		if (known !== undefined) return known;
		const formula = cells.formula(row, col);
		if (formula === undefined || visiting.has(key)) return false;
		visiting.add(key);
		const bounds = referencedBounds(formula);
		const inside = (coord: CellCoord) =>
			bounds.some(
				(b) =>
					coord.row >= b.top && coord.row <= b.bottom && coord.col >= b.left && coord.col <= b.right
			);
		formulaCoords ??= [...(cells.formulaKeys?.() ?? [])].map(keyToCoord);
		const result =
			editedCoords.some(inside) ||
			formulaCoords.some((coord) => inside(coord) && dependsOnEdit(coord.row, coord.col, visiting));
		visiting.delete(key);
		dirty.set(key, result);
		return result;
	}

	function compute(row: number, col: number, seen: ReadonlySet<string>): CellValue {
		const key = `${row}:${col}`;
		const formula = cells.formula(row, col);
		const stored = cells.value(row, col) ?? null;
		if (formula === undefined) return stored;
		const known = values.get(key);
		if (known !== undefined) return known;
		if (seen.has(key)) throw new FormulaError('#CIRC!');
		// A re-entered formula has no trustworthy saved value.
		const saved = stored !== null && !edited.has(key) ? stored : undefined;
		let result: CellValue;
		if (saved !== undefined && !dependsOnEdit(row, col, new Set())) {
			result = saved;
		} else {
			const inner = new Set(seen).add(key);
			const local = evaluateFormula(formula, (coord) => compute(coord.row, coord.col, inner));
			result = local === UNSUPPORTED ? (saved ?? new XlsxCellError('#NAME?')) : local;
		}
		values.set(key, result);
		return result;
	}

	return (row, col) => compute(row, col, new Set());
}

/**
 * Evaluates one value from a grid of plain values in which strings starting
 * with `=` are formulas (a convenience for simple string grids). Errors come
 * back as XlsxCellError (#DIV/0!, #VALUE!, #NAME?, #CIRC!).
 */
export function evaluateCell(raw: CellValue | undefined, get: CellGetter): CellValue {
	const formulaOf = (value: CellValue | undefined) =>
		typeof value === 'string' && value.startsWith('=') ? value.slice(1) : undefined;
	if (formulaOf(raw) === undefined) return raw ?? null;
	// The formula being evaluated sits at a virtual cell outside the grid.
	const evaluate = createSheetEvaluator({
		value: (row, col) => (row < 0 || formulaOf(get(row, col)) !== undefined ? undefined : get(row, col)),
		formula: (row, col) => (row < 0 ? formulaOf(raw) : formulaOf(get(row, col)))
	});
	return evaluate(-1, -1);
}
