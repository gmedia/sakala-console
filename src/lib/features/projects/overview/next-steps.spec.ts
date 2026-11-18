import { describe, expect, it } from 'vitest';
import { baseProject } from '../../../../../tests/e2e/fixtures/project-detail';
import type { Project } from '../type';
import {
	deriveNextSteps,
	dismissalStorageKey,
	MAX_NEXT_STEPS,
	readDismissedSteps,
	RELEASE_COMMAND_DOCS_URL,
	writeDismissedSteps,
	type DismissalStorage,
	type NextStepContext
} from './next-steps';

const laravel = {
	builder: 'railpack' as const,
	provider: 'php',
	framework: 'Laravel',
	package_manager: null
};
const inspection = {
	repository_url: null,
	commit_sha: null,
	dockerfile_found: false,
	env_example_found: true,
	compose_found: false,
	manifests: [],
	package_manager: null,
	inspected_at: null
};

/** Every rule quiet: auto-deploy on, a release command, one replica allowed. */
const quiet = (overrides: Partial<Project> = {}) =>
	({
		...baseProject,
		auto_deploy: true,
		release_command: null,
		replicas: 1,
		max_replicas: 1,
		...overrides
	}) as unknown as Project;

const context: NextStepContext = { variablesCount: 2, readOnly: false };
const ids = (project: Project, ctx = context, dismissed?: Set<string>) =>
	deriveNextSteps(project, ctx, dismissed).map((step) => step.id);

describe('next steps', () => {
	it('suggests nothing when nothing applies', () => {
		expect(ids(quiet())).toEqual([]);
	});

	it('asks for variables only when the repository has a .env.example and the project has none', () => {
		expect(ids(quiet({ inspection }), { ...context, variablesCount: 0 })).toEqual(['env-example']);
		expect(ids(quiet({ inspection }), { ...context, variablesCount: 2 })).toEqual([]);
		// Not read yet: no claim that the project has none.
		expect(ids(quiet({ inspection }), { ...context, variablesCount: null })).toEqual([]);
	});

	it('suggests a release command for Laravel without one, with the command and the guide', () => {
		const [step] = deriveNextSteps(quiet({ stack: laravel }), context);
		expect(step.id).toBe('release-command');
		expect(step.command).toBe('php artisan migrate --force');
		expect(step.action).toEqual({
			label: 'Atur release command',
			target: 'settings',
			anchor: 'releaseCommand'
		});
		expect(step.docs?.href).toBe(RELEASE_COMMAND_DOCS_URL);
		expect(ids(quiet({ stack: laravel, release_command: 'php artisan migrate --force' }))).toEqual(
			[]
		);
		expect(ids(quiet({ stack: { ...laravel, framework: 'next' } }))).toEqual([]);
	});

	it('suggests auto-deploy only where the GitHub App can send pushes', () => {
		expect(ids(quiet({ auto_deploy: false }))).toEqual(['auto-deploy']);
		expect(ids(quiet({ auto_deploy: false, repository_source: 'public_url' }))).toEqual([]);
		expect(deriveNextSteps(quiet({ auto_deploy: false }), context)[0].body).toContain(
			'branch main'
		);
	});

	it('mentions replicas only when the workspace allows more than one and the project runs one', () => {
		expect(ids(quiet({ max_replicas: 3 }))).toEqual(['replicas']);
		expect(ids(quiet({ max_replicas: 3, replicas: 2 }))).toEqual([]);
		expect(deriveNextSteps(quiet({ max_replicas: 3 }), context)[0].body).toContain(
			'sampai 3 replika'
		);
	});

	it('never shows more than three, in priority order', () => {
		const everything = quiet({ inspection, stack: laravel, auto_deploy: false, max_replicas: 3 });
		const steps = ids(everything, { ...context, variablesCount: 0 });
		expect(steps).toHaveLength(MAX_NEXT_STEPS);
		expect(steps).toEqual(['env-example', 'release-command', 'auto-deploy']);
	});

	it('fills a hidden slot with the next suggestion', () => {
		const everything = quiet({ inspection, stack: laravel, auto_deploy: false, max_replicas: 3 });
		expect(ids(everything, { ...context, variablesCount: 0 }, new Set(['auto-deploy']))).toEqual([
			'env-example',
			'release-command',
			'replicas'
		]);
	});

	it('suggests nothing to a viewer or for a suspended project', () => {
		const project = quiet({ auto_deploy: false });
		expect(ids(project, { ...context, readOnly: true })).toEqual([]);
		expect(ids(quiet({ auto_deploy: false, status: 'suspended' }))).toEqual([]);
	});
});

describe('hidden suggestions in storage', () => {
	function memoryStorage(initial: Record<string, string> = {}): DismissalStorage {
		const values = new Map(Object.entries(initial));
		return {
			getItem: (key) => values.get(key) ?? null,
			setItem: (key, value) => void values.set(key, value)
		};
	}

	it('remembers per project', () => {
		const storage = memoryStorage();
		writeDismissedSteps(storage, 'p-1', new Set(['replicas']));
		expect(readDismissedSteps(storage, 'p-1')).toEqual(new Set(['replicas']));
		expect(readDismissedSteps(storage, 'p-2')).toEqual(new Set());
	});

	it('forgets quietly when storage holds junk, refuses, or is missing', () => {
		expect(readDismissedSteps(memoryStorage({ [dismissalStorageKey('p')]: '{oops' }), 'p')).toEqual(
			new Set()
		);
		expect(
			readDismissedSteps(memoryStorage({ [dismissalStorageKey('p')]: '[1,"replicas"]' }), 'p')
		).toEqual(new Set(['replicas']));
		const refusing: DismissalStorage = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			}
		};
		expect(readDismissedSteps(refusing, 'p')).toEqual(new Set());
		expect(() => writeDismissedSteps(refusing, 'p', new Set(['x']))).not.toThrow();
		expect(readDismissedSteps(null, 'p')).toEqual(new Set());
	});
});
