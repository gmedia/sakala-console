import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/errors';
import {
	FIRST_DEPLOY_STEPS,
	firstDeploySteps,
	NO_STEPS_DONE,
	runFirstDeploy,
	withStepDone,
	type FirstDeployEffects,
	type FirstDeployPlan
} from './run-first-deploy';

const env = (id: number, key: string) => ({ id, key, value: 'v', isSecret: false });

function fakeEffects(overrides: Partial<FirstDeployEffects> = {}) {
	const order: string[] = [];
	const effects: FirstDeployEffects = {
		saveReleaseCommand: vi.fn(async (command) => order.push(`release:${command}`)),
		saveVariables: vi.fn(async (vars: readonly { key: string }[]) => {
			order.push(`variables:${vars.map((item) => item.key).join(',')}`);
			return [];
		}),
		createDatabase: vi.fn(async () => order.push('create-database')),
		attachDatabase: vi.fn(async (id) => order.push(`attach:${id}`)),
		deploy: vi.fn(async () => {
			order.push('deploy');
			return { id: 'd-1' };
		}),
		...overrides
	};
	return { effects, order };
}

const plan = (overrides: Partial<FirstDeployPlan> = {}): FirstDeployPlan => ({
	releaseCommand: 'php artisan migrate --force',
	envVars: [env(1, 'APP_KEY'), env(2, 'APP_NAME')],
	database: { kind: 'create' },
	...overrides
});

describe('withStepDone', () => {
	it('adds a step without changing the set it was given', () => {
		const before: ReadonlySet<'variables' | 'deploy'> = new Set(['variables'] as const);
		const after = withStepDone(NO_STEPS_DONE, 'variables');
		expect([...after]).toEqual(['variables']);
		expect(NO_STEPS_DONE.size).toBe(0);
		expect(before.size).toBe(1);
	});
});

describe('firstDeploySteps', () => {
	it('orders release command, variables, database, then deploy', () => {
		expect(firstDeploySteps(plan({ database: { kind: 'attach', databaseId: 'db-1' } }))).toEqual([
			'release-command',
			'variables',
			'database',
			'deploy'
		]);
	});

	it('leaves the deploy to the API for a new database', () => {
		expect(firstDeploySteps(plan())).toEqual(['release-command', 'variables', 'database']);
	});

	it('skips what the plan does not need', () => {
		expect(
			firstDeploySteps(plan({ releaseCommand: null, envVars: [], database: { kind: 'none' } }))
		).toEqual(['deploy']);
	});
});

describe('runFirstDeploy', () => {
	it('with a new database: saves the command and variables, creates it, then waits', async () => {
		const { effects, order } = fakeEffects();
		const result = await runFirstDeploy(plan(), new Set(), effects);
		expect(order).toEqual([
			'release:php artisan migrate --force',
			'variables:APP_KEY,APP_NAME',
			'create-database'
		]);
		expect(result.outcome).toEqual({ kind: 'waiting-for-database' });
		expect(effects.deploy).not.toHaveBeenCalled();
	});

	it('with an existing database: attaches it, then deploys', async () => {
		const { effects, order } = fakeEffects();
		const result = await runFirstDeploy(
			plan({ releaseCommand: null, database: { kind: 'attach', databaseId: 'db-9' } }),
			new Set(),
			effects
		);
		expect(order).toEqual(['variables:APP_KEY,APP_NAME', 'attach:db-9', 'deploy']);
		expect(result.outcome).toEqual({ kind: 'deployed', deploymentId: 'd-1' });
	});

	it('without a database: deploys right after the variables', async () => {
		const { effects, order } = fakeEffects();
		await runFirstDeploy(
			plan({ releaseCommand: null, database: { kind: 'none' } }),
			new Set(),
			effects
		);
		expect(order).toEqual(['variables:APP_KEY,APP_NAME', 'deploy']);
	});

	it('stops at refused variables, before anything is created', async () => {
		const failure = { env: env(2, 'APP_NAME'), message: 'ditolak' };
		const { effects, order } = fakeEffects({
			saveVariables: vi.fn(async () => {
				order.push('variables');
				return [failure];
			})
		});
		const result = await runFirstDeploy(plan(), new Set(), effects);
		expect(result.outcome).toEqual({ kind: 'variables-failed', failures: [failure] });
		expect(effects.createDatabase).not.toHaveBeenCalled();
		expect([...result.done]).toEqual([FIRST_DEPLOY_STEPS.releaseCommand]);
	});

	it('does not repeat the steps that succeeded when retried', async () => {
		const { effects, order } = fakeEffects();
		const result = await runFirstDeploy(
			plan({ envVars: [env(2, 'APP_NAME')] }),
			new Set([FIRST_DEPLOY_STEPS.releaseCommand]),
			effects
		);
		expect(order).toEqual(['variables:APP_NAME', 'create-database']);
		expect(result.done.has(FIRST_DEPLOY_STEPS.database)).toBe(true);
	});

	it('reports a refused database with its step, keeping the earlier steps done', async () => {
		const error = new ApiError('Penuh', 409, {}, undefined, { code: 'DATABASE_LIMIT_EXCEEDED' });
		const { effects } = fakeEffects({ createDatabase: vi.fn(async () => Promise.reject(error)) });
		const result = await runFirstDeploy(plan(), new Set(), effects);
		expect(result.outcome).toEqual({ kind: 'failed', step: 'database', error });
		expect([...result.done]).toEqual(['release-command', 'variables']);
	});

	it('goes on without a database after one was refused, reusing what was saved', async () => {
		const { effects, order } = fakeEffects();
		const result = await runFirstDeploy(
			plan({ database: { kind: 'none' } }),
			new Set([FIRST_DEPLOY_STEPS.releaseCommand, FIRST_DEPLOY_STEPS.variables]),
			effects
		);
		expect(order).toEqual(['deploy']);
		expect(result.outcome).toEqual({ kind: 'deployed', deploymentId: 'd-1' });
	});

	it('reports a refused deploy after attaching', async () => {
		const error = new ApiError('Belum siap', 409, {}, undefined, { code: 'DATABASE_NOT_READY' });
		const { effects } = fakeEffects({ deploy: vi.fn(async () => Promise.reject(error)) });
		const result = await runFirstDeploy(
			plan({ database: { kind: 'attach', databaseId: 'db-1' } }),
			new Set(),
			effects
		);
		expect(result.outcome).toEqual({ kind: 'failed', step: 'deploy', error });
		expect(result.done.has('database')).toBe(true);
	});

	it('stops a failed release command before the variables', async () => {
		const { effects } = fakeEffects({
			saveReleaseCommand: vi.fn(async () => Promise.reject(new Error('down')))
		});
		const result = await runFirstDeploy(plan(), new Set(), effects);
		expect(result.outcome).toMatchObject({ kind: 'failed', step: 'release-command' });
		expect(effects.saveVariables).not.toHaveBeenCalled();
	});

	it('lets an ended session through, so the login redirect is not hidden', async () => {
		const { effects } = fakeEffects({
			saveVariables: vi.fn(async () => Promise.reject(new ApiError('Unauthenticated.', 401)))
		});
		await expect(runFirstDeploy(plan(), new Set(), effects)).rejects.toThrow('Unauthenticated.');
	});

	it('only waits when a new database was already created in an earlier run', async () => {
		const { effects } = fakeEffects();
		const result = await runFirstDeploy(
			plan(),
			new Set(['release-command', 'variables', 'database'] as const),
			effects
		);
		expect(result.outcome).toEqual({ kind: 'waiting-for-database' });
		expect(effects.createDatabase).not.toHaveBeenCalled();
	});
});
