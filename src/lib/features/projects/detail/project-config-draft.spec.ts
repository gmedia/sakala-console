import { describe, expect, it } from 'vitest';
import {
	buildConfigPayload,
	hasConfigErrors,
	projectConfigDraftFrom,
	projectConfigErrors
} from './projectDetailState.svelte';

const project = {
	configured_port: null,
	build_command: null,
	start_command: null,
	release_command: null,
	root_directory: null,
	auto_deploy: false,
	replicas: 1
};
const original = projectConfigDraftFrom(project);

describe('replicas in the settings draft', () => {
	it('starts from the project setting, and from 1 when the API does not send it', () => {
		expect(original.replicas).toBe('1');
		expect(projectConfigDraftFrom({ ...project, replicas: undefined }).replicas).toBe('1');
	});

	it('sends a changed setting as a number, next to nothing else', () => {
		expect(
			buildConfigPayload({ ...original, replicas: '3' }, original, { maxReplicas: 4 })
		).toEqual({ replicas: 3 });
	});

	it('leaves replicas out when they did not change', () => {
		expect(
			buildConfigPayload({ ...original, build_command: 'npm run build' }, original, {
				maxReplicas: 4
			})
		).toEqual({ build_command: 'npm run build' });
	});

	it('refuses a setting outside the workspace range before anything is sent', () => {
		for (const replicas of ['0', '5', '']) {
			const errors = projectConfigErrors({ ...original, replicas }, original, { maxReplicas: 4 });
			expect(errors.replicas).toBe('Isi jumlah replika dengan bilangan bulat 1 sampai 4.');
			expect(() =>
				buildConfigPayload({ ...original, replicas }, original, { maxReplicas: 4 })
			).toThrow();
		}
	});

	it('keeps an untouched setting above a maximum an admin lowered later', () => {
		const kept = projectConfigDraftFrom({ ...project, replicas: 3 });
		const errors = projectConfigErrors({ ...kept, build_command: 'npm run build' }, kept, {
			maxReplicas: 1
		});
		expect(hasConfigErrors(errors)).toBe(false);
	});

	it('reports build field errors next to the replica error', () => {
		const errors = projectConfigErrors(
			{ ...original, configured_port: '70000', replicas: '9' },
			original,
			{ maxReplicas: 2 }
		);
		expect(errors.configured_port).toBeTruthy();
		expect(errors.replicas).toBe('Isi jumlah replika dengan bilangan bulat 1 sampai 2.');
	});
});

describe('release command in the settings draft', () => {
	const migrate = 'php artisan migrate --force';
	const withCommand = projectConfigDraftFrom({ ...project, release_command: migrate });

	it('starts empty when the project has none, or the API does not send it', () => {
		expect(original.release_command).toBe('');
		expect(projectConfigDraftFrom({ ...project, release_command: undefined }).release_command).toBe(
			''
		);
	});

	it('sends a new command trimmed, next to nothing else', () => {
		expect(buildConfigPayload({ ...original, release_command: `  ${migrate} ` }, original)).toEqual(
			{ release_command: migrate }
		);
	});

	it('sends null when the command is cleared, which removes it', () => {
		expect(buildConfigPayload({ ...withCommand, release_command: '  ' }, withCommand)).toEqual({
			release_command: null
		});
	});

	it('refuses a command over 1000 characters or on several lines', () => {
		expect(
			projectConfigErrors({ ...original, release_command: 'a'.repeat(1001) }, original, {
				maxReplicas: 1
			}).release_command
		).toBe('Release command paling panjang 1000 karakter.');
		expect(
			projectConfigErrors(
				{ ...original, release_command: 'php artisan migrate\nphp artisan db:seed' },
				original,
				{ maxReplicas: 1 }
			).release_command
		).toContain('harus satu baris');
		expect(
			hasConfigErrors(
				projectConfigErrors({ ...original, release_command: 'a'.repeat(1000) }, original, {
					maxReplicas: 1
				})
			)
		).toBe(false);
	});
});
