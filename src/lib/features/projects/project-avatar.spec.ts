import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	fnv1a32,
	getProjectAvatarTone,
	getProjectInitials,
	getProjectThumbnailUrl,
	initialsOf,
	PROJECT_AVATAR_TONES,
	type ProjectAvatarSource
} from './project-avatar';

const project = (overrides: Partial<ProjectAvatarSource> = {}): ProjectAvatarSource => ({
	id: 'proj_1',
	name: 'Toko Online',
	...overrides
});

describe('initialsOf', () => {
	it.each([
		['Toko Online', 'TO'],
		['toko-online-api', 'TO'],
		['toko_online', 'TO'],
		['toko.online', 'TO'],
		['acme/toko', 'AT'],
		['  toko   online  ', 'TO'],
		['sakala', 'S'],
		['2024 laporan', '2L']
	])('%s gives %s', (name, initials) => {
		expect(initialsOf(name)).toBe(initials);
	});

	it('skips emoji and symbols to the first letter or number', () => {
		expect(initialsOf('🚀 Rocket app')).toBe('RA');
		expect(initialsOf('— (beta) toko')).toBe('BT');
	});

	it('reads letters of any script', () => {
		expect(initialsOf('Проект Альфа')).toBe('ПА');
		expect(initialsOf('日本語サイト')).toBe('日');
		expect(initialsOf('ελληνικά έργο')).toBe('ΕΈ');
	});

	it('keeps a combining mark on its letter instead of cutting the grapheme', () => {
		// "e" followed by U+0301, written decomposed on purpose.
		expect(initialsOf('e\u0301cole primaire')).toBe('E\u0301P');
		expect(initialsOf('हिंदी साइट')).toBe('हिंसा');
	});

	it('uppercases the same way whatever the browser language', () => {
		expect(initialsOf('istanbul izmir')).toBe('II');
	});

	it.each(['🚀🔥', '— ・ ★', '', '   ', '---'])(
		'gives null for %j, which has no letter or number',
		(name) => {
			expect(initialsOf(name)).toBeNull();
		}
	);
});

describe('getProjectInitials', () => {
	it('uses the name first', () => {
		expect(
			getProjectInitials(project({ slug: 'lain', public_url: 'https://lain.sakala.app' }))
		).toBe('TO');
	});

	it('falls back to the slug when the name is only emoji', () => {
		expect(getProjectInitials(project({ name: '🚀🔥', slug: 'rocket-app' }))).toBe('RA');
	});

	it('falls back to the subdomain of the public URL, which is the slug, when the list sends no slug', () => {
		expect(
			getProjectInitials(project({ name: '🚀🔥', public_url: 'https://x7k2pq.sakala.app' }))
		).toBe('X');
	});

	it('gives null, so the tile shows an icon, when nothing has a letter or number', () => {
		expect(getProjectInitials(project({ name: '🚀🔥' }))).toBeNull();
		// The API joins scheme and domain, so a project without a domain arrives as a bare `https://`.
		expect(
			getProjectInitials(project({ name: '🚀🔥', slug: '', public_url: 'https://' }))
		).toBeNull();
	});
});

describe('getProjectAvatarTone', () => {
	it('gives the same tone for the same id, every time', () => {
		const tones = Array.from({ length: 5 }, () => getProjectAvatarTone('proj_1'));
		expect(new Set(tones).size).toBe(1);
	});

	it('depends on the id only, so renaming a project keeps its colour', () => {
		const before = project({ name: 'Toko Online' });
		const after = project({ name: 'Toko Daring' });
		expect(getProjectAvatarTone(after.id)).toBe(getProjectAvatarTone(before.id));
	});

	it('reaches every tone of the palette across a spread of ids', () => {
		const ids = Array.from({ length: 200 }, (_, index) => `01a0cd45-c5a6-7170-9f8d-${index}`);
		const reached = new Set(ids.map(getProjectAvatarTone));
		expect([...reached].sort()).toEqual([...PROJECT_AVATAR_TONES].sort());
	});

	it('has one tone per --color-avatar-* token in app.css, and no more', () => {
		const css = readFileSync(resolve(import.meta.dirname, '../../../app.css'), 'utf8');
		const tokens = [...css.matchAll(/--color-(avatar-\d+):/g)].map((match) => `bg-${match[1]}`);
		expect([...PROJECT_AVATAR_TONES]).toEqual(tokens);
	});
});

describe('fnv1a32', () => {
	it.each([
		['', 0x811c9dc5],
		['a', 0xe40c292c],
		['foobar', 0xbf9cf968]
	])('matches the published FNV-1a 32-bit value for %j', (value, hash) => {
		expect(fnv1a32(value)).toBe(hash);
	});
});

describe('getProjectThumbnailUrl', () => {
	it('returns the URL the API sends', () => {
		expect(getProjectThumbnailUrl(project({ thumbnail_url: 'https://img.test/a.png' }))).toBe(
			'https://img.test/a.png'
		);
	});

	it.each([null, undefined, '', '   '])('returns null for %j', (thumbnail_url) => {
		expect(getProjectThumbnailUrl(project({ thumbnail_url }))).toBeNull();
	});
});
