import { describe, expect, it } from 'vitest';
import { getVariableBuildHint, VARIABLE_BUILD_COPY } from './presentation';
import type { VariableChanges } from './type';
import {
	decideVariableBuild,
	projectVariableChanges,
	VARIABLE_SOURCES,
	type VariableBuildProject
} from './variable-build';

const PREFIXES = ['NEXT_PUBLIC_', 'VITE_', 'PUBLIC_'];
const KEYS = ['NODE_ENV'];

function policy(overrides: Partial<VariableChanges> = {}): VariableChanges {
	return {
		requires_build: false,
		reason: null,
		build_time_prefixes: PREFIXES,
		build_time_keys: KEYS,
		...overrides
	};
}

const live = 'deployment-1';

function project(
	variableChanges: VariableChanges | undefined,
	activeDeploymentId: string | null = live
): VariableBuildProject {
	return { variable_changes: variableChanges, active_deployment_id: activeDeploymentId };
}

const keys = (...names: string[]) => projectVariableChanges(names);

describe('decideVariableBuild', () => {
	it.each([['static_site'], ['prerender_framework'], ['unknown_stack']] as const)(
		'builds for any key when the project reason is %s',
		(reason) => {
			expect(
				decideVariableBuild(project(policy({ requires_build: true, reason })), keys('API_URL'))
			).toEqual({ needsBuild: true, reason });
		}
	);

	it('still builds without a live image when the project needs it', () => {
		expect(
			decideVariableBuild(
				project(policy({ requires_build: true, reason: 'static_site' }), null),
				keys('API_URL')
			)
		).toEqual({ needsBuild: true, reason: 'static_site' });
	});

	it('treats a build without a reason it knows as unknown_stack', () => {
		expect(
			decideVariableBuild(project(policy({ requires_build: true, reason: null })), keys('A'))
		).toEqual({ needsBuild: true, reason: 'unknown_stack' });
	});

	it('reuses the image on a plain server for a runtime key', () => {
		expect(decideVariableBuild(project(policy()), keys('API_URL'))).toEqual({ needsBuild: false });
	});

	it('builds on a plain server for a build-time prefix, naming the prefix', () => {
		expect(decideVariableBuild(project(policy()), keys('VITE_API_URL'))).toEqual({
			needsBuild: true,
			reason: 'build_time_prefix',
			key: 'VITE_API_URL',
			prefix: 'VITE_'
		});
	});

	it('names the first prefix in the API order', () => {
		expect(decideVariableBuild(project(policy()), keys('PUBLIC_SITE'))).toMatchObject({
			prefix: 'PUBLIC_'
		});
		expect(decideVariableBuild(project(policy()), keys('NEXT_PUBLIC_X'))).toMatchObject({
			prefix: 'NEXT_PUBLIC_'
		});
	});

	it('builds for a build-time key, with no prefix', () => {
		expect(decideVariableBuild(project(policy()), keys('NODE_ENV'))).toEqual({
			needsBuild: true,
			reason: 'build_time_prefix',
			key: 'NODE_ENV',
			prefix: null
		});
	});

	it('matches prefixes case-sensitively and only at the start', () => {
		expect(decideVariableBuild(project(policy()), keys('vite_api_url'))).toEqual({
			needsBuild: false
		});
		expect(decideVariableBuild(project(policy()), keys('MY_VITE_URL'))).toEqual({
			needsBuild: false
		});
		expect(decideVariableBuild(project(policy()), keys('NODE_ENV_EXTRA'))).toEqual({
			needsBuild: false
		});
	});

	it('builds a batch as soon as one key needs it', () => {
		expect(
			decideVariableBuild(project(policy()), keys('API_URL', 'SECRET', 'NEXT_PUBLIC_URL'))
		).toMatchObject({ needsBuild: true, key: 'NEXT_PUBLIC_URL', prefix: 'NEXT_PUBLIC_' });
		expect(decideVariableBuild(project(policy()), keys('API_URL', 'SECRET'))).toEqual({
			needsBuild: false
		});
	});

	it('never builds for the database variables, even on a static site', () => {
		const database = [
			{ key: 'DATABASE_URL', source: VARIABLE_SOURCES.database },
			{ key: 'DB_PASSWORD', source: VARIABLE_SOURCES.database }
		];
		expect(
			decideVariableBuild(
				project(policy({ requires_build: true, reason: 'static_site' })),
				database
			)
		).toEqual({ needsBuild: false });
		// A project variable with the database's name is the user's own, and follows the project.
		expect(
			decideVariableBuild(project(policy({ requires_build: true, reason: 'static_site' })), [
				...database,
				...keys('DATABASE_URL')
			])
		).toEqual({ needsBuild: true, reason: 'static_site' });
	});

	it('says nothing about reuse when there is no live image to reuse', () => {
		expect(decideVariableBuild(project(policy(), null), keys('API_URL'))).toBeNull();
		expect(decideVariableBuild(project(policy(), null), keys('VITE_X'))).toMatchObject({
			needsBuild: true
		});
	});

	it('says nothing without a change or a project', () => {
		expect(decideVariableBuild(project(policy()), [])).toBeNull();
		expect(decideVariableBuild(undefined, keys('A'))).toBeNull();
	});

	describe('an older API without variable_changes', () => {
		it('keeps the old prefix rule for the keys it lists', () => {
			expect(decideVariableBuild(project(undefined), keys('VITE_API_URL'))).toMatchObject({
				needsBuild: true,
				reason: 'build_time_prefix',
				prefix: 'VITE_'
			});
			expect(decideVariableBuild(project(undefined), keys('NODE_ENV'))).toMatchObject({
				prefix: null
			});
		});

		it('says nothing for other keys rather than promise a reuse it cannot check', () => {
			expect(decideVariableBuild(project(undefined), keys('API_URL'))).toBeNull();
		});

		it('still says the database variables never build', () => {
			expect(
				decideVariableBuild(project(undefined), [
					{ key: 'DATABASE_URL', source: VARIABLE_SOURCES.database }
				])
			).toEqual({ needsBuild: false });
		});
	});
});

describe('getVariableBuildHint', () => {
	it('says a reuse is a restart without a build', () => {
		expect(getVariableBuildHint({ needsBuild: false }, null)).toBe(
			'Cukup restart dengan image yang sama (tanpa build).'
		);
	});

	it('explains a static site', () => {
		expect(getVariableBuildHint({ needsBuild: true, reason: 'static_site' }, null)).toBe(
			'Perubahan ini butuh build ulang karena situs ini disajikan sebagai file statis, jadi nilai variabel ikut tersimpan di hasil build.'
		);
	});

	it.each([
		['next', 'Next.js'],
		['nuxt', 'Nuxt'],
		['astro', 'Astro'],
		['sveltekit', 'SvelteKit']
	])('names the framework %s as %s', (framework, label) => {
		expect(
			getVariableBuildHint({ needsBuild: true, reason: 'prerender_framework' }, framework)
		).toBe(
			`Perubahan ini butuh build ulang karena ${label} bisa membuat halaman saat build, jadi nilai variabel ikut tersimpan di hasil build.`
		);
	});

	it('speaks of the framework in general when it is not known', () => {
		expect(getVariableBuildHint({ needsBuild: true, reason: 'prerender_framework' }, null)).toBe(
			VARIABLE_BUILD_COPY.prerenderFramework(null)
		);
		expect(VARIABLE_BUILD_COPY.prerenderFramework(null)).toContain('framework aplikasi ini');
	});

	it('names the matched prefix, or the key', () => {
		expect(
			getVariableBuildHint(
				{ needsBuild: true, reason: 'build_time_prefix', key: 'VITE_URL', prefix: 'VITE_' },
				'vite'
			)
		).toBe('Perubahan ini butuh build ulang karena variabel berawalan VITE_ dibaca saat build.');
		expect(
			getVariableBuildHint(
				{ needsBuild: true, reason: 'build_time_prefix', key: 'NODE_ENV', prefix: null },
				null
			)
		).toBe('Perubahan ini butuh build ulang karena NODE_ENV dibaca saat build.');
	});

	it('is honest about a stack Sakala cannot read', () => {
		expect(getVariableBuildHint({ needsBuild: true, reason: 'unknown_stack' }, null)).toBe(
			'Perubahan ini butuh build ulang karena Sakala belum bisa memastikan cara aplikasi ini membaca variabel.'
		);
	});
});
