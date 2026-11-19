import { describe, expect, it, vi } from 'vitest';
import {
	databaseFixtureNames,
	errorFromDatabaseFixture,
	getDatabaseFixture
} from '$lib/testing/database-fixtures';
import { apiRequest } from '../client';
import { DATABASE_ERROR_CODES } from '../errors';
import { parseDatabaseRefusal } from './database-refusals';
import {
	attachDatabase,
	createDatabase,
	deleteDatabase,
	detachDatabase,
	getDatabaseCredentials,
	installDatabaseExtension,
	parseAttachment,
	parseCredentials,
	parseDatabase,
	parseDatabaseList,
	rotateDatabasePassword
} from './databases';
import { parsePilotLimitsResponse } from './pilot-limits';
import { parseListProjectsResponse } from './projects';
import { parseWorkspaceList } from './workspaces';
import { parseRegionList } from './regions';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const SUCCESS_PARSERS: Record<string, (body: unknown) => unknown> = {
	databases: parseDatabaseList,
	'database-create': parseDatabase,
	'database-show': parseDatabase,
	'database-show-extension-failed': parseDatabase,
	'database-rename': parseDatabase,
	'database-delete': parseDatabase,
	'rotate-password': parseDatabase,
	'rotate-password-redeploy': parseDatabase,
	'database-show-rotation-completed': parseDatabase,
	'database-show-rotation-failed': parseDatabase,
	'extension-install': parseDatabase,
	attach: parseAttachment,
	'attach-again': parseAttachment,
	credentials: parseCredentials,
	regions: parseRegionList,
	'pilot-limits-databases': parsePilotLimitsResponse,
	'projects-list': parseListProjectsResponse,
	workspaces: parseWorkspaceList
};

describe('database resources, against responses captured from sakala-api', () => {
	it('tests every captured success response', () => {
		const successes = databaseFixtureNames().filter((name) => {
			const { status } = getDatabaseFixture(name);
			return status < 300 && status !== 204 && !name.startsWith('project-');
		});
		expect(successes.sort()).toEqual(Object.keys(SUCCESS_PARSERS).sort());
	});

	it.each(Object.entries(SUCCESS_PARSERS))('parses %s', (name, parse) => {
		expect(() => parse(getDatabaseFixture(name).body)).not.toThrow();
	});

	it('reads the list with each status, attached projects, sizes, and failures', () => {
		const databases = parseDatabaseList(getDatabaseFixture('databases').body);
		expect(databases.map((database) => database.status)).toEqual([
			'failed',
			'locked',
			'ready',
			'ready'
		]);
		const attached = databases.find((database) => database.projects.length > 0);
		expect(attached?.projects[0].name).toBe('toko-kopi-web');
		expect(attached?.size_bytes).toBe(12 * 1024 * 1024);
		expect(databases[0].last_failure?.command).toBe('CreateDatabase');
		expect(databases[0].size_bytes).toBeNull();
	});

	it('gives every member the connection without the password once the node reported it', () => {
		const databases = parseDatabaseList(getDatabaseFixture('databases').body);
		const ready = databases.find((database) => database.status === 'ready')!;
		expect(ready.connection).toEqual({
			host: '10.0.47.30',
			port: 5432,
			database: expect.stringMatching(/^p_/),
			username: expect.stringMatching(/^p_/)
		});
		expect(ready.connection).not.toHaveProperty('password');
		expect(databases.find((database) => database.status === 'failed')?.connection).toBeNull();
		expect(parseDatabase(getDatabaseFixture('database-create').body).connection).toBeNull();
	});

	it('reads a database from the first database API, without connection, as null', () => {
		const { connection, ...older } = (
			getDatabaseFixture('database-show').body as { data: Record<string, unknown> }
		).data;
		expect(connection).not.toBeUndefined();
		expect(parseDatabase({ data: older }).connection).toBeNull();
	});

	it('reads the attached database on the project list, and the workspace default region', () => {
		const projects = parseListProjectsResponse(getDatabaseFixture('projects-list').body).data;
		expect(projects.find((project) => project.name === 'toko-kopi-web')?.databases).toEqual([
			{ id: expect.any(String), name: 'toko-kopi-db', status: 'ready' }
		]);
		expect(projects.find((project) => project.name === 'api-kasir')?.databases).toEqual([]);
		const workspaces = parseWorkspaceList(getDatabaseFixture('workspaces').body);
		expect(workspaces.map((workspace) => workspace.default_region)).toEqual([null, 'jkt']);
	});

	it('reads the rotation state: pending, completed with the redeploys queued, and failed', () => {
		const pending = parseDatabase(getDatabaseFixture('rotate-password-redeploy').body);
		expect(pending.password_rotation).toMatchObject({
			status: 'pending',
			completed_at: null,
			redeploy_attached: true,
			redeploys: null
		});

		const completed = parseDatabase(getDatabaseFixture('database-show-rotation-completed').body);
		const web = completed.projects.find((project) => project.name === 'toko-kopi-web')!;
		const admin = completed.projects.find((project) => project.name === 'toko-kopi-admin')!;
		expect(completed.password_rotation?.status).toBe('completed');
		expect(completed.password_rotation?.completed_at).toEqual(expect.any(String));
		expect(completed.password_rotation?.redeploys).toEqual(
			expect.arrayContaining([
				{ project_id: web.id, deployment_id: expect.any(String), skipped_reason: null },
				{ project_id: admin.id, deployment_id: null, skipped_reason: 'no_active_deployment' }
			])
		);

		const failed = parseDatabase(getDatabaseFixture('database-show-rotation-failed').body);
		expect(failed.password_rotation).toMatchObject({
			status: 'failed',
			failed_at: expect.any(String),
			redeploy_attached: false,
			redeploys: null
		});
		expect(failed.last_failure?.command).toBe('RotateDatabasePassword');
	});

	it('reads a database from an API without rotation state as never rotated', () => {
		expect(parseDatabase(getDatabaseFixture('database-show').body).password_rotation).toBeNull();
	});

	it('reads a new database as provisioning and a deleted one as deleting', () => {
		expect(parseDatabase(getDatabaseFixture('database-create').body).status).toBe('provisioning');
		expect(parseDatabase(getDatabaseFixture('database-delete').body).status).toBe('deleting');
	});

	it('reads the credentials with the URL the projects receive', () => {
		const credentials = parseCredentials(getDatabaseFixture('credentials').body);
		expect(credentials.url).toContain(`@${credentials.host}:${credentials.port}/`);
		expect(credentials.sslmode).toBe('require');
	});

	it('reads the database quotas from pilot-limits', () => {
		const limits = parsePilotLimitsResponse(getDatabaseFixture('pilot-limits-databases').body);
		expect(limits.quotas.max_databases).toBe(3);
		expect(limits.quotas.max_database_storage_mb).toBe(512);
	});

	it('reads the project resource with its attached database and overridden variables', () => {
		const project = getDatabaseFixture('project-with-database').body as {
			data: { databases: { name: string; variables: string[]; overridden_variables: string[] }[] };
		};
		expect(project.data.databases[0].overridden_variables).toEqual(['DB_HOST']);
		expect(project.data.databases[0].variables).not.toContain('DB_HOST');
		const without = getDatabaseFixture('project-without-database').body as {
			data: { databases: unknown[] };
		};
		expect(without.data.databases).toEqual([]);
	});

	it.each([
		['database-create-limit', 422, DATABASE_ERROR_CODES.limitExceeded],
		['database-create-storage-limit', 422, DATABASE_ERROR_CODES.storageLimitExceeded],
		['database-create-region-unavailable', 409, DATABASE_ERROR_CODES.regionUnavailable],
		['attach-cross-region', 409, DATABASE_ERROR_CODES.crossRegionUnsupported],
		['attach-not-ready', 409, DATABASE_ERROR_CODES.notReady],
		['attach-locked', 409, DATABASE_ERROR_CODES.locked],
		['attach-project-already-attached', 409, DATABASE_ERROR_CODES.projectAlreadyAttached],
		['database-delete-in-use', 409, DATABASE_ERROR_CODES.inUse],
		['rotate-password-busy', 409, DATABASE_ERROR_CODES.busy],
		['credentials-not-ready', 409, DATABASE_ERROR_CODES.notReady]
	])('keeps the code of %s', (name, status, code) => {
		const error = errorFromDatabaseFixture(name);
		expect(error.status).toBe(status);
		expect(error.code).toBe(code);
	});

	it('reads the documented fields of each refusal', () => {
		expect(
			parseDatabaseRefusal(
				'DATABASE_LIMIT_EXCEEDED',
				errorFromDatabaseFixture('database-create-limit').details
			)
		).toEqual({ limit: 3, current: 3 });
		expect(
			parseDatabaseRefusal(
				'DATABASE_IN_USE',
				errorFromDatabaseFixture('database-delete-in-use').details
			)?.projects.map((project) => project.name)
		).toEqual(['toko-kopi-web']);
		expect(
			parseDatabaseRefusal(
				'DATABASE_CROSS_REGION_UNSUPPORTED',
				errorFromDatabaseFixture('attach-cross-region').details
			)
		).toEqual({ database_region: 'jkt', project_region: 'sby' });
		expect(parseDatabaseRefusal('DATABASE_LIMIT_EXCEEDED', { limit: 'x' })).toBeNull();
	});
});

describe('database requests', () => {
	const mocked = vi.mocked(apiRequest);

	it('sends each request to its workspace-scoped path', async () => {
		mocked.mockResolvedValue(getDatabaseFixture('database-show').body);
		await createDatabase('ws 1', { name: 'db', region: null });
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws%201/databases', {
			method: 'POST',
			json: { name: 'db', region: null }
		});

		await deleteDatabase('ws', 'db-1');
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/databases/db-1', {
			method: 'DELETE'
		});

		await rotateDatabasePassword('ws', 'db-1', { redeploy_attached: true });
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/databases/db-1/rotate-password',
			{ method: 'POST', json: { redeploy_attached: true } }
		);

		await installDatabaseExtension('ws', 'db-1', 'vector');
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/databases/db-1/extensions', {
			method: 'POST',
			json: { extension: 'vector' }
		});

		mocked.mockResolvedValue(getDatabaseFixture('attach').body);
		await attachDatabase('ws', 'db-1', 'p-1');
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/databases/db-1/attachments/p-1',
			{ method: 'POST' }
		);

		mocked.mockResolvedValue(undefined);
		await detachDatabase('ws', 'db-1', 'p-1');
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/databases/db-1/attachments/p-1',
			{ method: 'DELETE' }
		);
	});

	it('never lets the browser cache the credentials', async () => {
		mocked.mockResolvedValue(getDatabaseFixture('credentials').body);
		await getDatabaseCredentials('ws', 'db-1');
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/databases/db-1/credentials',
			{ cache: 'no-store' }
		);
	});
});
