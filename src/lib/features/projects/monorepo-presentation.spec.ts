import { describe, expect, it } from 'vitest';
import {
	monorepoHeadline,
	monorepoRows,
	parseWorkspaceEventMetadata
} from './monorepo-presentation';

const monorepo = {
	manager: 'pnpm' as const,
	root_directory: '.',
	package_directory: 'apps/web',
	package_name: '@kopi/web',
	build_command: 'pnpm --filter @kopi/web run build',
	start_command: null,
	static_output_directory: 'apps/web/dist'
};

describe('monorepo presentation', () => {
	it('says what was detected and where the app comes from', () => {
		expect(monorepoHeadline(monorepo)).toBe(
			'Monorepo pnpm terdeteksi — build dari root workspace, aplikasi dari apps/web'
		);
		expect(monorepoHeadline({ ...monorepo, manager: 'yarn' })).toContain('Monorepo Yarn');
	});

	it('lists the root, the package, and the derived commands', () => {
		expect(monorepoRows(monorepo)).toEqual([
			{ label: 'Root workspace', value: 'root repository', code: false },
			{ label: 'Package', value: '@kopi/web (apps/web)', code: true },
			{ label: 'Build command', value: 'pnpm --filter @kopi/web run build', code: true },
			{
				label: 'Start command',
				value: 'Disajikan sebagai situs statis dari apps/web/dist',
				code: false
			}
		]);
	});

	it('says in words when a script is missing, instead of leaving it blank', () => {
		const rows = monorepoRows({
			...monorepo,
			root_directory: 'frontend',
			package_name: null,
			build_command: null,
			static_output_directory: null
		});
		expect(rows[0]).toEqual({ label: 'Root workspace', value: 'frontend', code: true });
		expect(rows[1].value).toBe('apps/web');
		expect(rows[2]).toMatchObject({ value: 'Tidak ada script build', code: false });
		expect(rows[3]).toMatchObject({ value: 'Tidak ada script start', code: false });
	});

	it('reads the event metadata only when it has the documented shape', () => {
		expect(parseWorkspaceEventMetadata(monorepo)).toEqual(monorepo);
		expect(parseWorkspaceEventMetadata([])).toBeNull();
		expect(parseWorkspaceEventMetadata({ ...monorepo, manager: 'lerna' })).toBeNull();
		expect(parseWorkspaceEventMetadata(null)).toBeNull();
	});
});
