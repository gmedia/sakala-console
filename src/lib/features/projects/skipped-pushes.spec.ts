import { describe, expect, it } from 'vitest';
import {
	groupSkippedPushes,
	shortSha,
	skippedPushesSince,
	isHeldPush,
	skippedPushFiles,
	skippedPushTitle
} from './skipped-pushes';
import type { SkippedPush } from './type';

function skip(overrides: Partial<SkippedPush> = {}): SkippedPush {
	return {
		delivery_id: '6f1c2a3e-58cc-4372-a567-0e02b2c3d479',
		reason: 'no_changes_in_root_directory',
		commit_sha: '1234567890abcdef1234567890abcdef12345678',
		commit_message: 'feat(api): tambah endpoint',
		branch: 'main',
		root_directory: 'apps/web',
		changed_path_count: 2,
		example_paths: ['apps/api/routes.php', 'apps/api/app.php'],
		after_deployment_id: 'd1',
		created_at: '2026-11-19T06:30:00+00:00',
		...overrides
	};
}

describe('skippedPushesSince', () => {
	it('is the oldest deployment on the page', () => {
		expect(
			skippedPushesSince([
				{ created_at: '2026-11-19T06:00:00Z' },
				{ created_at: '2026-11-17T06:00:00Z' },
				{ created_at: '2026-11-18T06:00:00Z' }
			])
		).toBe('2026-11-17T06:00:00Z');
	});

	it('is undefined without a usable deployment time', () => {
		expect(skippedPushesSince([])).toBeUndefined();
		expect(skippedPushesSince([{ created_at: 'bukan tanggal' }])).toBeUndefined();
	});
});

describe('groupSkippedPushes', () => {
	it('groups skips under the deployment they followed and drops the ones from other pages', () => {
		const newer = skip({ delivery_id: 'a', after_deployment_id: 'd2' });
		const older = skip({ delivery_id: 'b', after_deployment_id: 'd2' });
		const first = skip({ delivery_id: 'c', after_deployment_id: 'd1' });
		const elsewhere = skip({ delivery_id: 'd', after_deployment_id: 'other-page' });

		const groups = groupSkippedPushes(
			[{ id: 'd2' }, { id: 'd1' }],
			[newer, older, first, elsewhere]
		);

		expect(groups.get('d2')).toEqual([newer, older]);
		expect(groups.get('d1')).toEqual([first]);
		expect(groups.has('other-page')).toBe(false);
	});
});

describe('copy', () => {
	it('names the folder the push did not touch', () => {
		expect(skippedPushTitle(skip())).toBe('Tidak ada perubahan di apps/web');
		expect(shortSha(skip().commit_sha)).toBe('1234567');
	});

	it('counts the files it does not list', () => {
		expect(
			skippedPushFiles(skip({ changed_path_count: 8, example_paths: ['a', 'b', 'c', 'd', 'e'] }))
		).toEqual({
			summary: '8 file berubah, semuanya di folder proyek lain:',
			paths: ['a', 'b', 'c', 'd', 'e'],
			more: 'dan 3 file lainnya'
		});
		expect(skippedPushFiles(skip()).more).toBeNull();
	});
});

describe('a push held while auto-deploy is paused', () => {
	const held = skip({ reason: 'auto_deploy_paused', root_directory: '' });

	it('says it was held, not that the folder had no changes', () => {
		expect(isHeldPush(held)).toBe(true);
		expect(isHeldPush(skip())).toBe(false);
		expect(skippedPushTitle(held)).toBe('Auto-deploy sedang dijeda');
	});

	it('lists the files without claiming they belong to other projects', () => {
		expect(skippedPushFiles(held).summary).toBe('2 file berubah:');
	});
});
