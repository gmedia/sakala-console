import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '$lib/api/errors';
import { parseDatabaseList } from '$lib/api/resources/databases';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import { databaseAccess } from './access';
import {
	BYTES_PER_MB,
	DATABASE_TRANSITION_POLL_MS,
	QUOTA_COPY,
	addRedeployNotices,
	databaseErrorMessage,
	databaseQuota,
	databaseRowNote,
	databaseStatusView,
	extensionFailure,
	formatDatabaseSize,
	isOnNode,
	provisioningSteps,
	redeployNoticeText,
	resolveDatabasePollInterval,
	rotationFailure,
	separateFailure,
	storageMeter
} from './presentation';
import { databaseVariableRows, overriddenNames } from './project-variables';

const databases = parseDatabaseList(getDatabaseFixture('databases').body);
const byName = (name: string) => databases.find((database) => database.name === name)!;

describe('databaseStatusView', () => {
	it.each([
		['provisioning', 'Menyiapkan', 'running', true],
		['ready', 'Siap', 'success', false],
		['failed', 'Gagal', 'error', false],
		['deleting', 'Menghapus', 'queued', true],
		['locked', 'Terkunci', 'warning', false]
	] as const)('labels %s', (status, label, tone, transitional) => {
		const view = databaseStatusView({ status, last_failure: null });
		expect(view).toMatchObject({ label, tone, transitional });
		expect(view.description).not.toBe('');
	});

	it('explains a lock with what to do about it', () => {
		const view = databaseStatusView(byName('arsip-lama'));
		expect(view.description).toMatch(/penyimpanan database workspace ini penuh/i);
		expect(view.description).toMatch(/minta admin Sakala menaikkan kuota/);
	});

	it('uses the API summary for a failed creation, and says to recreate it', () => {
		const view = databaseStatusView(byName('percobaan'));
		expect(view.description).toContain('tidak menyelesaikan permintaan ini tepat waktu');
		expect(view.description).toMatch(/Hapus database ini lalu buat lagi/);
	});

	it('shows a status from a newer API as itself', () => {
		expect(databaseStatusView({ status: 'migrating', last_failure: null })).toMatchObject({
			label: 'migrating',
			tone: 'neutral'
		});
	});

	it('notes the statuses a list row must explain', () => {
		expect(databaseRowNote({ status: 'ready' })).toBeNull();
		expect(databaseRowNote({ status: 'locked' })).toMatch(/tidak bisa terhubung/);
		expect(databaseRowNote({ status: 'unknown' })).toBeNull();
	});
});

describe('polling and progress', () => {
	it('polls only while the node creates or drops a database', () => {
		expect(resolveDatabasePollInterval(databases)).toBe(false);
		expect(resolveDatabasePollInterval([{ status: 'provisioning' }])).toBe(
			DATABASE_TRANSITION_POLL_MS
		);
		expect(resolveDatabasePollInterval([{ status: 'deleting' }])).toBe(DATABASE_TRANSITION_POLL_MS);
		expect(resolveDatabasePollInterval(undefined)).toBe(false);
	});

	it('shows the step the node is on, without a made-up percentage', () => {
		expect(provisioningSteps({ status: 'provisioning' }).map((step) => step.state)).toEqual([
			'done',
			'current',
			'pending'
		]);
		expect(provisioningSteps({ status: 'ready' }).every((step) => step.state === 'done')).toBe(
			true
		);
	});

	it('counts ready and locked databases as on the node', () => {
		expect(isOnNode({ status: 'ready' })).toBe(true);
		expect(isOnNode({ status: 'locked' })).toBe(true);
		expect(isOnNode({ status: 'provisioning' })).toBe(false);
	});
});

describe('failures', () => {
	it('separates an extension failure from the status', () => {
		const analytics = byName('analitik');
		expect(extensionFailure(analytics)?.code).toBe('database_extension_unavailable');
		expect(separateFailure(analytics)?.code).toBe('database_extension_unavailable');
		expect(rotationFailure(analytics)).toBeNull();
	});

	it('does not repeat a failed creation beside its own status', () => {
		expect(separateFailure(byName('percobaan'))).toBeNull();
	});
});

describe('sizes and quota', () => {
	it('formats sizes in the API megabytes', () => {
		expect(formatDatabaseSize(12 * BYTES_PER_MB)).toBe('12 MB');
		expect(formatDatabaseSize(7.5 * BYTES_PER_MB)).toBe('7,5 MB');
		expect(formatDatabaseSize(1536 * BYTES_PER_MB)).toBe('1,5 GB');
		expect(formatDatabaseSize(null)).toBe('Belum diukur');
	});

	it('marks storage as nearly full at 80% and full at the quota', () => {
		expect(storageMeter(12 * BYTES_PER_MB, 512)).toMatchObject({
			level: 'ok',
			label: '12 MB dari 512 MB'
		});
		expect(storageMeter(410 * BYTES_PER_MB, 512).level).toBe('warning');
		expect(storageMeter(600 * BYTES_PER_MB, 512)).toMatchObject({ level: 'full', ratio: 1 });
		expect(storageMeter(0, 0).level).toBe('full');
		expect(storageMeter(null, 512).accessibleLabel).toMatch(/belum diukur/);
	});

	it('summarises the quota as the brief words it', () => {
		const quota = databaseQuota({
			max_databases: 2,
			current_databases_count: 1,
			max_database_storage_mb: 512,
			current_database_storage_bytes: 12 * BYTES_PER_MB
		});
		expect(quota?.count.label).toBe('1 dari 2 database');
		expect(quota?.storage.label).toBe('12 MB dari 512 MB');
		expect(quota?.blockedReason).toBeNull();
	});

	it('says why a new database would be refused', () => {
		const base = {
			max_databases: 2,
			current_databases_count: 0,
			max_database_storage_mb: 512,
			current_database_storage_bytes: 0
		};
		expect(databaseQuota({ ...base, max_databases: 0 })?.blockedReason).toBe(QUOTA_COPY.disabled);
		expect(databaseQuota({ ...base, current_databases_count: 2 })?.blockedReason).toBe(
			QUOTA_COPY.countFull(2)
		);
		expect(
			databaseQuota({ ...base, current_database_storage_bytes: 512 * BYTES_PER_MB })?.blockedReason
		).toBe(QUOTA_COPY.storageFull);
	});

	it('shows nothing for an API without database quotas', () => {
		expect(databaseQuota({ max_databases: 2 })).toBeNull();
		expect(databaseQuota(undefined)).toBeNull();
	});
});

describe('databaseErrorMessage', () => {
	it('rebuilds quota refusals with their numbers', () => {
		expect(
			databaseErrorMessage(errorFromDatabaseFixture('database-create-limit'), 'create', 'x')
		).toBe(QUOTA_COPY.countFull(3));
		expect(
			databaseErrorMessage(errorFromDatabaseFixture('database-create-storage-limit'), 'create', 'x')
		).toMatch(/sudah penuh \(20 MB dari 10 MB\)/);
	});

	it('explains a disabled workspace apart from a full one', () => {
		const error = new ApiError('x', 422, {}, undefined, {
			code: 'DATABASE_LIMIT_EXCEEDED',
			details: { limit: 0, current: 0 }
		});
		expect(databaseErrorMessage(error, 'create', 'x')).toBe(QUOTA_COPY.disabled);
	});

	it('points a missing region to the automatic choice', () => {
		expect(
			databaseErrorMessage(
				errorFromDatabaseFixture('database-create-region-unavailable'),
				'create',
				'x'
			)
		).toBe('Belum ada server database di region sby. Pilih region lain, atau pilih Otomatis.');
		const anywhere = new ApiError('x', 409, {}, undefined, {
			code: 'DATABASE_REGION_UNAVAILABLE',
			details: { region: null }
		});
		expect(databaseErrorMessage(anywhere, 'create', 'x')).toMatch(/operator Sakala/);
	});

	it.each([
		['attach-cross-region', /region jkt, sedangkan proyek ini berjalan di region sby/],
		['attach-project-already-attached', /sudah memakai database toko-kopi-db/],
		['attach-locked', /dikunci/],
		['database-delete-in-use', /Lepas dulu dari semua proyek/],
		['rotate-password-busy', /masih berjalan/],
		['attach-not-ready', /masih dibuat/]
	])('keeps the API text for %s', (name, text) => {
		expect(databaseErrorMessage(errorFromDatabaseFixture(name), 'attach', 'x')).toMatch(text);
	});

	it('names who may do it on a 403, per action', () => {
		expect(
			databaseErrorMessage(errorFromDatabaseFixture('credentials-member'), 'credentials', 'x')
		).toBe('Kredensial hanya bisa dilihat pemilik workspace.');
		expect(
			databaseErrorMessage(errorFromDatabaseFixture('database-create-viewer'), 'create', 'x')
		).toMatch(/pemilik dan anggota workspace/);
	});

	it('explains a detach of a project that is no longer attached', () => {
		expect(
			databaseErrorMessage(errorFromDatabaseFixture('detach-not-attached'), 'detach', 'x')
		).toMatch(/sudah tidak terpasang/);
	});

	it('falls back for anything that is not an API answer', () => {
		expect(databaseErrorMessage(new TypeError('boom'), 'create', 'fallback')).toBe('fallback');
		expect(databaseErrorMessage(new NetworkError(), 'create', 'fallback')).toMatch(
			/tidak dapat dijangkau/
		);
	});
});

describe('databaseAccess', () => {
	it.each([
		['owner', false, true, true],
		['member', false, true, false],
		['viewer', false, false, false],
		[null, true, true, true]
	] as const)('role %s, admin %s', (role, admin, canManage, canViewCredentials) => {
		expect(databaseAccess(role, admin)).toEqual({ canManage, canViewCredentials });
	});
});

describe('project variables', () => {
	const project = getDatabaseFixture('project-with-database').body as {
		data: {
			databases: {
				id: string;
				name: string;
				status: string;
				region: string | null;
				variables: string[];
				overridden_variables: string[];
			}[];
		};
	};
	const database = project.data.databases[0];

	it('lists every connection variable in order, marking the overridden one', () => {
		const rows = databaseVariableRows(database);
		expect(rows.map((row) => row.name)).toEqual([
			'DATABASE_URL',
			'DB_CONNECTION',
			'DB_HOST',
			'DB_PORT',
			'DB_DATABASE',
			'DB_USERNAME',
			'DB_PASSWORD'
		]);
		expect(rows.filter((row) => row.overridden).map((row) => row.name)).toEqual(['DB_HOST']);
	});

	it('keeps a name only a newer API sends', () => {
		expect(
			databaseVariableRows({ ...database, variables: [...database.variables, 'DB_SSLMODE'] }).at(-1)
		).toEqual({ name: 'DB_SSLMODE', overridden: false });
	});

	it('collects the overriding names for the project list', () => {
		expect([...overriddenNames(project.data.databases)]).toEqual(['DB_HOST']);
		expect(overriddenNames(undefined).size).toBe(0);
	});
});

describe('redeploy notices', () => {
	it('asks for a redeploy after each kind of change', () => {
		expect(redeployNoticeText({ projectId: 'p', projectName: 'web', kind: 'attached' })).toMatch(
			/^Redeploy web/
		);
		expect(
			redeployNoticeText({
				projectId: 'p',
				projectName: 'web',
				kind: 'attached',
				redeployRequired: false
			})
		).toMatch(/saat deploy berikutnya/);
		expect(redeployNoticeText({ projectId: 'p', projectName: 'web', kind: 'detached' })).toMatch(
			/Datanya tetap ada/
		);
		expect(redeployNoticeText({ projectId: 'p', projectName: 'web', kind: 'rotated' })).toMatch(
			/password baru/
		);
	});

	it('keeps one notice per project, the newest', () => {
		const notices = addRedeployNotices(
			[{ projectId: 'p', projectName: 'web', kind: 'attached' }],
			[{ projectId: 'p', projectName: 'web', kind: 'rotated' }]
		);
		expect(notices).toEqual([{ projectId: 'p', projectName: 'web', kind: 'rotated' }]);
	});
});
