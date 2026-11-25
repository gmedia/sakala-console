import { describe, expect, it, vi } from 'vitest';
import {
	errorFromValkeyFixture,
	getValkeyFixture,
	valkeyFixtureNames
} from '$lib/testing/valkey-fixtures';
import { apiRequest } from '../client';
import { VALKEY_ERROR_CODES } from '../errors';
import { parsePilotLimitsResponse } from './pilot-limits';
import { parseValkeyRefusal } from './valkey-refusals';
import {
	attachValkey,
	createValkey,
	deleteValkey,
	detachValkey,
	parseValkey,
	parseValkeyAttachment,
	parseValkeyCredentials,
	parseValkeyList,
	revealValkeyCredentials,
	rotateValkeyPassword,
	updateValkey
} from './valkeys';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const SUCCESS_PARSERS: Record<string, (body: unknown) => unknown> = {
	valkeys: parseValkeyList,
	'valkeys-empty': parseValkeyList,
	'valkey-create': parseValkey,
	'valkey-create-for-project': parseValkey,
	'valkey-show': parseValkey,
	'valkey-show-cache': parseValkey,
	'valkey-show-failed': parseValkey,
	'valkey-show-locked': parseValkey,
	'valkey-show-pending-resize': parseValkey,
	'valkey-show-resize-failed': parseValkey,
	'valkey-show-rotation-completed': parseValkey,
	'valkey-show-rotation-unknown': parseValkey,
	'valkey-rename': parseValkey,
	'valkey-resize': parseValkey,
	'valkey-delete': parseValkey,
	'rotate-password': parseValkey,
	'rotate-password-redeploy': parseValkey,
	attach: parseValkeyAttachment,
	'attach-again': parseValkeyAttachment,
	credentials: parseValkeyCredentials,
	'pilot-limits-valkeys': parsePilotLimitsResponse,
	'pilot-limits-valkeys-empty': parsePilotLimitsResponse,
	'pilot-limits-valkeys-off': parsePilotLimitsResponse,
	'pilot-limits-valkeys-unavailable': parsePilotLimitsResponse,
	'pilot-limits-valkeys-zero': parsePilotLimitsResponse
};

const MB = 1024 * 1024;

describe('Valkey resources, against responses captured from sakala-api', () => {
	it('tests every captured success response', () => {
		const successes = valkeyFixtureNames().filter((name) => {
			const { status } = getValkeyFixture(name);
			return status < 300 && status !== 204 && !name.startsWith('project');
		});
		expect(successes.sort()).toEqual(Object.keys(SUCCESS_PARSERS).sort());
	});

	it.each(Object.entries(SUCCESS_PARSERS))('parses %s', (name, parse) => {
		expect(() => parse(getValkeyFixture(name).body)).not.toThrow();
	});

	it('reads the list newest first, with mode, size, usage, and attached projects', () => {
		const valkeys = parseValkeyList(getValkeyFixture('valkeys').body);
		expect(valkeys.map((valkey) => [valkey.name, valkey.mode, valkey.status])).toEqual([
			['cache-gagal', 'cache', 'failed'],
			['sesi-lama', 'persistent', 'locked'],
			['katalog-api', 'cache', 'ready'],
			['antrean-toko', 'persistent', 'ready']
		]);
		const queue = valkeys[3];
		expect(queue.maxmemory_mb).toBe(64);
		expect(queue.usage.used_memory_bytes).toBe(18 * MB);
		expect(queue.projects.map((project) => project.name)).toEqual(['toko-kopi-web']);
		expect(valkeys[0].connection).toBeNull();
	});

	it('gives every member the address without the password once the store runs', () => {
		const valkey = parseValkey(getValkeyFixture('valkey-show').body);
		expect(valkey.connection).toEqual({ host: '10.213.0.2', port: 6379 });
		expect(JSON.stringify(getValkeyFixture('valkey-show').body)).not.toMatch(/password"\s*:/);
		const created = parseValkey(getValkeyFixture('valkey-create').body);
		expect(created).toMatchObject({ status: 'provisioning', connection: null });
	});

	it('names a store made for a project after it, attached in the same step', () => {
		const valkey = parseValkey(getValkeyFixture('valkey-create-for-project').body);
		expect(valkey).toMatchObject({ name: 'katalog-api', mode: 'cache', maxmemory_mb: 32 });
		expect(valkey.projects.map((project) => project.name)).toEqual(['katalog-api']);
	});

	it('reads the credentials as exactly the injected variables, REDIS_URL without a database number', () => {
		const credentials = parseValkeyCredentials(getValkeyFixture('credentials').body);
		expect(Object.keys(credentials.variables)).toEqual([
			'REDIS_URL',
			'REDIS_HOST',
			'REDIS_PORT',
			'REDIS_PASSWORD'
		]);
		expect(credentials.url).toBe(`redis://:${credentials.password}@10.213.0.2:6379`);
		expect(credentials.url).not.toMatch(/\/\d+$/);
	});

	it('reads a pending resize, a refused shrink, and both rotation endings', () => {
		expect(parseValkey(getValkeyFixture('valkey-show-pending-resize').body)).toMatchObject({
			maxmemory_mb: 64,
			pending_maxmemory_mb: 32
		});
		expect(
			parseValkey(getValkeyFixture('valkey-show-resize-failed').body).last_failure
		).toMatchObject({
			command: 'ResizeValkey',
			code: 'valkey_size_below_usage',
			user_fixable: true
		});
		const completed = parseValkey(getValkeyFixture('valkey-show-rotation-completed').body);
		expect(completed.password_rotation).toMatchObject({
			status: 'completed',
			redeploy_attached: true
		});
		expect(completed.password_rotation?.redeploys).toHaveLength(1);
		expect(
			parseValkey(getValkeyFixture('valkey-show-rotation-unknown').body).password_rotation?.status
		).toBe('unknown');
	});

	it('reads the availability and quota of pilot-limits, also while the flag is off', () => {
		const off = parsePilotLimitsResponse(getValkeyFixture('pilot-limits-valkeys-off').body);
		expect(off.valkeys).toEqual({
			enabled: false,
			available: false,
			sizes_mb: [32, 64, 128],
			default_size_mb: 64
		});
		expect(off.quotas.max_valkeys).toBe(0);
		const on = parsePilotLimitsResponse(getValkeyFixture('pilot-limits-valkeys').body);
		expect(on.quotas).toMatchObject({
			max_valkeys: 3,
			current_valkeys_count: 3,
			max_valkey_memory_mb: 160,
			current_valkey_memory_mb: 160
		});
	});

	it('reads every documented refusal field from the captured errors', () => {
		const limit = errorFromValkeyFixture('valkey-create-limit');
		expect(limit.code).toBe(VALKEY_ERROR_CODES.limitExceeded);
		expect(parseValkeyRefusal('VALKEY_LIMIT_EXCEEDED', limit.details)).toEqual({
			limit: 3,
			current: 3
		});
		const memory = errorFromValkeyFixture('valkey-create-memory-limit');
		expect(parseValkeyRefusal('VALKEY_MEMORY_LIMIT_EXCEEDED', memory.details)).toEqual({
			limit_mb: 160,
			current_mb: 96,
			requested_mb: 128
		});
		expect(
			parseValkeyRefusal('VALKEY_IN_USE', errorFromValkeyFixture('valkey-delete-in-use').details)
				?.projects[0].name
		).toBe('toko-kopi-web');
		expect(
			parseValkeyRefusal(
				'VALKEY_NODE_MISMATCH',
				errorFromValkeyFixture('attach-node-mismatch').details
			)?.valkey.name
		).toBe('antrean-toko');
		expect(
			parseValkeyRefusal(
				'PROJECT_VALKEY_ALREADY_ATTACHED',
				errorFromValkeyFixture('attach-project-already-attached').details
			)?.valkey.name
		).toBe('antrean-toko');
		expect(
			parseValkeyRefusal(
				'VALKEY_PASSWORD_ROTATING',
				errorFromValkeyFixture('credentials-password-rotating').details
			)?.valkey.name
		).toBe('antrean-toko-kopi');
		expect(
			parseValkeyRefusal('VALKEY_NOT_READY', errorFromValkeyFixture('attach-not-ready').details)
		).toEqual({ status: 'provisioning' });
		expect(parseValkeyRefusal('VALKEY_LIMIT_EXCEEDED', { limit: 'x' })).toBeNull();
	});

	it('names every code the API sent with the Console constants', () => {
		const known = new Set<string>(Object.values(VALKEY_ERROR_CODES));
		const sent = valkeyFixtureNames()
			.map((name) => errorFromValkeyFixture(name).code)
			.filter(
				(code): code is string => Boolean(code) && code !== 'ACTIVE_DEPLOYMENT_LIMIT_EXCEEDED'
			);
		for (const code of sent) expect(known.has(code), code).toBe(true);
	});
});

describe('Valkey requests', () => {
	const workspace = 'ws-1';
	const request = vi.mocked(apiRequest);

	it('sends the documented paths and bodies', async () => {
		request.mockResolvedValue(getValkeyFixture('valkey-create').body);
		await createValkey(workspace, {
			name: 'antrean',
			mode: 'persistent',
			maxmemory_mb: 64,
			region: null
		});
		expect(request).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws-1/valkeys', {
			method: 'POST',
			json: { name: 'antrean', mode: 'persistent', maxmemory_mb: 64, region: null }
		});

		request.mockResolvedValue(getValkeyFixture('valkey-resize').body);
		await updateValkey(workspace, 'vk-1', { maxmemory_mb: 32 });
		expect(request).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws-1/valkeys/vk-1', {
			method: 'PATCH',
			json: { maxmemory_mb: 32 }
		});

		request.mockResolvedValue(getValkeyFixture('rotate-password').body);
		await rotateValkeyPassword(workspace, 'vk-1', { redeploy_attached: true });
		expect(request).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws-1/valkeys/vk-1/rotate-password',
			{ method: 'POST', json: { redeploy_attached: true } }
		);

		request.mockResolvedValue(getValkeyFixture('attach').body);
		await attachValkey(workspace, 'vk-1', 'p 1');
		expect(request).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws-1/valkeys/vk-1/attachments/p%201',
			{ method: 'POST' }
		);

		request.mockResolvedValue(undefined);
		await detachValkey(workspace, 'vk-1', 'p1');
		expect(request).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws-1/valkeys/vk-1/attachments/p1',
			{ method: 'DELETE' }
		);
	});

	it('reads the password without caching, and a delete that left nothing as null', async () => {
		request.mockResolvedValue(getValkeyFixture('credentials').body);
		await revealValkeyCredentials(workspace, 'vk-1');
		expect(request).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws-1/valkeys/vk-1/credentials',
			{ cache: 'no-store' }
		);

		request.mockResolvedValue(undefined);
		await expect(deleteValkey(workspace, 'vk-1')).resolves.toBeNull();
		request.mockResolvedValue(getValkeyFixture('valkey-delete').body);
		await expect(deleteValkey(workspace, 'vk-1')).resolves.toMatchObject({ status: 'deleting' });
	});
});
