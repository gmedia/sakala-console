import { describe, expect, it } from 'vitest';
import { parseDatabaseList } from '$lib/api/resources/databases';
import { getDatabaseFixture } from '$lib/testing/database-fixtures';
import { DATABASE_ANCHORS, DATABASE_HELP_LINKS, deriveDatabaseSteps } from './panel';

/** A captured database that is ready and attached to a project. */
const attached = () =>
	parseDatabaseList(getDatabaseFixture('databases').body).find(
		(database) => database.status === 'ready' && database.projects.length > 0
	)!;

describe('the database panel next steps', () => {
	it('suggests nothing for a database already in use', () => {
		expect(deriveDatabaseSteps(attached(), true)).toEqual([]);
	});

	it('suggests attaching a database no project uses', () => {
		expect(deriveDatabaseSteps({ ...attached(), projects: [] }, true)).toEqual([
			{ id: 'attach', label: 'Pasang ke proyek', href: `#${DATABASE_ANCHORS.projects}` }
		]);
	});

	it('gives a viewer and a database that is not ready nothing', () => {
		const idle = { ...attached(), projects: [] };
		expect(deriveDatabaseSteps(idle, false)).toEqual([]);
		for (const status of ['provisioning', 'locked', 'failed', 'deleting']) {
			expect(deriveDatabaseSteps({ ...idle, status }, true)).toEqual([]);
		}
	});

	it('links the database and release command guides', () => {
		expect(DATABASE_HELP_LINKS.map((link) => link.href)).toEqual([
			'https://sakala.dev/docs/database-terkelola',
			'https://sakala.dev/docs/perintah-rilis'
		]);
	});
});
