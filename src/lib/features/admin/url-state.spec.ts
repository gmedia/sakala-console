import { describe, expect, it } from 'vitest';
import {
	PAGE_SIZE,
	nextSearch,
	rangePatch,
	rangeToParams,
	readListState,
	readRange,
	toApiParams,
	validateCustomRange
} from './url-state';

const SPEC = { search: 'text', role: ['user', 'admin'], workspace_id: 'id' } as const;

describe('readListState', () => {
	it('reads the page and every filter in the spec', () => {
		const state = readListState(new URLSearchParams('page=3&search= rani &role=admin'), SPEC);
		expect(state).toEqual({ page: 3, search: 'rani', role: 'admin', workspace_id: '' });
	});

	it('drops values the API would refuse, so a bad link shows the unfiltered list', () => {
		const state = readListState(
			new URLSearchParams('page=-2&role=superuser&workspace_id=../../etc'),
			SPEC
		);
		expect(state).toEqual({ page: 1, search: '', role: '', workspace_id: '' });
	});

	it('cuts free text at the API limit of 255 characters', () => {
		const state = readListState(new URLSearchParams(`search=${'a'.repeat(300)}`), SPEC);
		expect(state.search).toHaveLength(255);
	});

	it('treats a fractional page as the first page', () => {
		expect(readListState(new URLSearchParams('page=2.5'), SPEC).page).toBe(1);
	});
});

describe('toApiParams', () => {
	it('leaves out empty filters and adds the page size', () => {
		expect(toApiParams({ page: 2, search: '', role: 'admin' })).toEqual({
			page: 2,
			role: 'admin',
			per_page: PAGE_SIZE
		});
	});
});

describe('nextSearch', () => {
	it('starts again at page 1 when a filter changes', () => {
		expect(nextSearch(new URLSearchParams('page=4&role=user'), { role: 'admin' })).toBe(
			'?role=admin'
		);
	});

	it('keeps the filters when only the page changes, and drops page 1 from the URL', () => {
		const current = new URLSearchParams('role=admin');
		expect(nextSearch(current, { page: 2 })).toBe('?page=2&role=admin');
		expect(nextSearch(new URLSearchParams('page=2&role=admin'), { page: 1 })).toBe('?role=admin');
	});

	it('removes a filter set to empty or null, and returns an empty string for none', () => {
		expect(nextSearch(new URLSearchParams('search=x&role=admin'), { search: '', role: null })).toBe(
			''
		);
	});

	it('sorts parameters, so the same view always has the same address', () => {
		expect(nextSearch(new URLSearchParams(), { status: 'open', category: 'bug' })).toBe(
			'?category=bug&status=open'
		);
	});
});

describe('time ranges', () => {
	const allowed = ['7d', '30d', '90d', 'custom'] as const;

	it('falls back to the default for a range the page does not offer', () => {
		expect(readRange(new URLSearchParams('range=all'), allowed, '30d')).toEqual({
			range: '30d',
			from: '',
			to: ''
		});
	});

	it('reads a valid custom range with its dates', () => {
		const state = readRange(
			new URLSearchParams('range=custom&from=2026-11-01&to=2026-11-11'),
			allowed,
			'30d'
		);
		expect(rangeToParams(state)).toEqual({ range: 'custom', from: '2026-11-01', to: '2026-11-11' });
	});

	it('refuses a custom range that is reversed, impossible, or longer than 366 days', () => {
		expect(validateCustomRange('2026-11-11', '2026-11-01')).toMatch(/sebelum/);
		expect(validateCustomRange('2026-02-30', '2026-03-01')).toMatch(/Isi tanggal/);
		expect(validateCustomRange('2025-01-01', '2026-01-02')).toMatch(/366 hari/);
		expect(validateCustomRange('2025-01-01', '2026-01-01')).toBeNull();
		expect(
			readRange(new URLSearchParams('range=custom&from=2026-11-11&to=2026-11-01'), allowed, '7d')
				.range
		).toBe('7d');
	});

	it('clears the dates when switching away from a custom range', () => {
		expect(rangePatch({ range: '7d', from: '', to: '' })).toEqual({
			range: '7d',
			from: null,
			to: null
		});
		expect(rangeToParams({ range: '90d', from: 'x', to: 'y' })).toEqual({ range: '90d' });
	});
});
