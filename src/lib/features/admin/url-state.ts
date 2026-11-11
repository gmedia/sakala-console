import type { QueryParams } from '$lib/api/resources/admin/common';

/**
 * Admin lists keep their page, search, and filters in the query string, so a view can be shared,
 * reloaded, and walked back with the browser. The URL is read through a spec: anything the API
 * would refuse is dropped here, and the page falls back to the unfiltered list instead of an error.
 */

export const PAGE_SIZE = 25;

/** A fixed set of values, free text, or an ID the API matches exactly. */
export type ParamKind = readonly string[] | 'text' | 'id';
export type ParamSpec = Record<string, ParamKind>;
export type ListState<S extends ParamSpec> = { page: number } & { [K in keyof S]: string };

const MAX_TEXT = 255;
const ID_PATTERN = /^[\w.:-]{1,64}$/;

function readValue(raw: string | null, kind: ParamKind): string {
	const value = raw?.trim() ?? '';
	if (!value) return '';
	if (kind === 'text') return value.slice(0, MAX_TEXT);
	if (kind === 'id') return ID_PATTERN.test(value) ? value : '';
	return kind.includes(value) ? value : '';
}

export function readPage(search: URLSearchParams): number {
	const page = Number(search.get('page'));
	return Number.isInteger(page) && page > 0 ? page : 1;
}

export function readListState<S extends ParamSpec>(search: URLSearchParams, spec: S): ListState<S> {
	const state = { page: readPage(search) } as ListState<S>;
	for (const [key, kind] of Object.entries(spec)) {
		(state as Record<string, unknown>)[key] = readValue(search.get(key), kind);
	}
	return state;
}

/** The API query: empty filters left out, the fixed page size added. */
export function toApiParams(state: Record<string, string | number>): QueryParams {
	const params: QueryParams = { per_page: PAGE_SIZE };
	for (const [key, value] of Object.entries(state)) {
		if (value !== '' && value !== undefined) params[key] = value;
	}
	return params;
}

export type ParamPatch = Record<string, string | number | null | undefined>;

/**
 * The next query string. Changing anything but the page starts again at page 1, because page 4 of
 * the old filter means nothing for the new one. Returns `''` for no parameters at all.
 */
export function nextSearch(current: URLSearchParams, patch: ParamPatch): string {
	const next = new URLSearchParams(current);
	if (Object.keys(patch).some((key) => key !== 'page')) next.delete('page');
	for (const [key, value] of Object.entries(patch)) {
		const text = value === null || value === undefined ? '' : String(value).trim();
		if (text === '' || (key === 'page' && text === '1')) next.delete(key);
		else next.set(key, text);
	}
	next.sort();
	const query = next.toString();
	return query ? `?${query}` : '';
}

export type RangeKey = '7d' | '30d' | '90d' | 'custom' | 'all';
export type RangeState = { range: RangeKey; from: string; to: string };

export const MAX_CUSTOM_RANGE_DAYS = 366;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string): number | null {
	if (!DATE_PATTERN.test(value)) return null;
	const time = Date.parse(`${value}T00:00:00Z`);
	// Date.parse rolls 2026-02-31 over to March; the round trip catches it.
	if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
	return time;
}

/** The message for a custom range the API would refuse, or null when it is fine. */
export function validateCustomRange(from: string, to: string): string | null {
	const start = parseDay(from);
	const end = parseDay(to);
	if (start === null || end === null) return 'Isi tanggal mulai dan tanggal akhir.';
	if (end < start) return 'Tanggal akhir tidak boleh sebelum tanggal mulai.';
	const days = (end - start) / 86_400_000 + 1;
	if (days > MAX_CUSTOM_RANGE_DAYS) {
		return `Rentang waktu paling panjang ${MAX_CUSTOM_RANGE_DAYS} hari.`;
	}
	return null;
}

export function readRange(
	search: URLSearchParams,
	allowed: readonly RangeKey[],
	fallback: RangeKey
): RangeState {
	const range = search.get('range') as RangeKey | null;
	if (!range || !allowed.includes(range)) return { range: fallback, from: '', to: '' };
	if (range !== 'custom') return { range, from: '', to: '' };
	const from = search.get('from') ?? '';
	const to = search.get('to') ?? '';
	return validateCustomRange(from, to) === null
		? { range, from, to }
		: { range: fallback, from: '', to: '' };
}

/** `from` and `to` only go with `custom`; the API refuses them otherwise. */
export function rangeToParams(state: RangeState): QueryParams {
	return state.range === 'custom'
		? { range: 'custom', from: state.from, to: state.to }
		: { range: state.range };
}

/** The query patch for a range: switching away from custom clears its dates. */
export function rangePatch(state: RangeState): ParamPatch {
	return state.range === 'custom'
		? { range: 'custom', from: state.from, to: state.to }
		: { range: state.range, from: null, to: null };
}
