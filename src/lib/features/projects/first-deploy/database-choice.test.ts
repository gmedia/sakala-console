import { describe, expect, it } from 'vitest';
import {
	attachCandidates,
	createDatabaseBlockedReason,
	DATABASE_CHOICE_COPY,
	defaultDatabaseOption,
	firstUsableCandidate,
	suggestedReleaseCommand
} from './database-choice';

const database = (
	id: string,
	overrides: Partial<{
		status: string;
		region: string | null;
		projects: { id: string; name: string; slug: string }[];
	}> = {}
) => ({ id, name: `db-${id}`, status: 'ready', region: 'jkt', projects: [], ...overrides });

describe('defaultDatabaseOption', () => {
	it('preselects a new database when the app likely needs one and it can be made', () => {
		expect(defaultDatabaseOption({ likely: true, createBlocked: false })).toBe('create');
	});

	it('preselects none when it is not likely, or when a new one cannot be made', () => {
		expect(defaultDatabaseOption({ likely: false, createBlocked: false })).toBe('none');
		expect(defaultDatabaseOption({ likely: true, createBlocked: true })).toBe('none');
	});
});

describe('createDatabaseBlockedReason', () => {
	it('names an installation without a database server first', () => {
		expect(createDatabaseBlockedReason({ unavailable: true, quotaBlockedReason: 'penuh' })).toBe(
			DATABASE_CHOICE_COPY.unavailable
		);
	});

	it('passes the quota reason through, and is null when nothing blocks', () => {
		expect(createDatabaseBlockedReason({ unavailable: false, quotaBlockedReason: 'penuh' })).toBe(
			'penuh'
		);
		expect(
			createDatabaseBlockedReason({ unavailable: false, quotaBlockedReason: null })
		).toBeNull();
	});
});

describe('attachCandidates', () => {
	const project = { id: 'p-1', region: 'jkt' };

	it('allows a ready database that no other project uses', () => {
		expect(attachCandidates([database('a')], project)).toEqual([
			{ id: 'a', name: 'db-a', disabledReason: null }
		]);
	});

	it('disables one that is not ready, with the reason', () => {
		const candidates = attachCandidates(
			[
				database('a', { status: 'provisioning' }),
				database('b', { status: 'failed' }),
				database('c', { status: 'locked' }),
				database('d', { status: 'something-new' })
			],
			project
		);
		expect(candidates.map((item) => item.disabledReason)).toEqual([
			'Masih dibuat',
			'Gagal dibuat',
			'Terkunci, penyimpanan workspace penuh',
			'Belum siap'
		]);
	});

	it('disables one attached to another project, naming it, but not one attached here', () => {
		const candidates = attachCandidates(
			[
				database('a', { projects: [{ id: 'p-2', name: 'toko-teh', slug: 'toko-teh' }] }),
				database('b', { projects: [{ id: 'p-1', name: 'kopi', slug: 'kopi' }] })
			],
			project
		);
		expect(candidates[0].disabledReason).toBe('Dipakai toko-teh');
		expect(candidates[1].disabledReason).toBeNull();
	});

	it('disables one in another region, and allows any when the project has no region yet', () => {
		expect(attachCandidates([database('a', { region: 'sby' })], project)[0].disabledReason).toBe(
			'Region sby, proyek ini di jkt'
		);
		expect(
			attachCandidates([database('a', { region: 'sby' })], { id: 'p-1', region: null })[0]
				.disabledReason
		).toBeNull();
	});

	it('picks the first usable one as the select’s starting value', () => {
		const candidates = attachCandidates(
			[database('a', { status: 'failed' }), database('b'), database('c')],
			project
		);
		expect(firstUsableCandidate(candidates)).toBe('b');
		expect(firstUsableCandidate([])).toBeNull();
	});
});

describe('suggestedReleaseCommand', () => {
	const suggestion = 'php artisan migrate --force';

	it('suggests the agent’s command when a database is chosen and none is set', () => {
		expect(suggestedReleaseCommand({ option: 'create', current: null, suggestion })).toBe(
			suggestion
		);
		expect(suggestedReleaseCommand({ option: 'attach', current: '  ', suggestion })).toBe(
			suggestion
		);
	});

	it('keeps an existing release command, and suggests nothing without a database', () => {
		expect(
			suggestedReleaseCommand({ option: 'create', current: 'make migrate', suggestion })
		).toBeNull();
		expect(suggestedReleaseCommand({ option: 'none', current: null, suggestion })).toBeNull();
		expect(
			suggestedReleaseCommand({ option: 'create', current: null, suggestion: null })
		).toBeNull();
	});
});
