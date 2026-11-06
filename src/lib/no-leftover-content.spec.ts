import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
// Split so this file does not contain what it searches for.
const CONTRIBUTOR_MARKERS = ['sasong' + 'ko', 'ssn' + 'gk'];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory() ? sourceFiles(path) : [path];
	});
}

describe('production source holds no leftover personal or sample data', () => {
	it("does not contain the contributor's name or email", () => {
		const hits = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'tests'))].filter(
			(path) => {
				const content = readFileSync(path, 'utf8').toLowerCase();
				return CONTRIBUTOR_MARKERS.some((marker) => content.includes(marker));
			}
		);

		expect(hits).toEqual([]);
	});

	it('has no notification fixtures or in-memory store', () => {
		const feature = join(ROOT, 'src/lib/features/notifications');

		expect(existsSync(join(feature, 'fixtures.ts'))).toBe(false);
		expect(existsSync(join(feature, 'store.svelte.ts'))).toBe(false);
	});

	it('has no simulated verification screen', () => {
		expect(existsSync(join(ROOT, 'src/routes/(public)/login/verify'))).toBe(false);
	});

	it('has no fake wizard: no mocks, no simulated deploy step, no made-up domain', () => {
		const projects = join(ROOT, 'src/lib/features/projects');

		expect(existsSync(join(projects, 'mock'))).toBe(false);
		expect(existsSync(join(ROOT, 'src/lib/features/deployments/mock'))).toBe(false);
		expect(existsSync(join(projects, 'components/create/DeployStep.svelte'))).toBe(false);

		const production = sourceFiles(join(ROOT, 'src')).filter(
			(path) => !/\.(test|spec)\.ts$/.test(path) && !path.endsWith('schema.d.ts')
		);
		const hits = production.filter((path) => {
			const content = readFileSync(path, 'utf8');
			return /from '[^']*\/mock(\/[^']*)?'/.test(content) || content.includes('run.sakala.dev');
		});

		expect(hits).toEqual([]);
	});
});
