import { z } from 'zod';
import type { ProjectMonorepo } from './type';

const MANAGER_LABELS: Record<ProjectMonorepo['manager'], string> = {
	npm: 'npm',
	pnpm: 'pnpm',
	yarn: 'Yarn',
	bun: 'Bun'
};

/** `root_directory` is relative to the repository root, and `.` is that root. */
const REPOSITORY_ROOT = '.';

export type MonorepoRow = { label: string; value: string; code: boolean };

export function monorepoHeadline(monorepo: ProjectMonorepo): string {
	return `Monorepo ${MANAGER_LABELS[monorepo.manager]} terdeteksi — build dari root workspace, aplikasi dari ${monorepo.package_directory}`;
}

/**
 * What the build will run, in the order a reader checks it. `null` is a fact from the agent (no
 * such script, or a static site), so it is said in words instead of left blank.
 */
export function monorepoRows(monorepo: ProjectMonorepo): MonorepoRow[] {
	const root =
		monorepo.root_directory === REPOSITORY_ROOT ? 'root repository' : monorepo.root_directory;
	const start = monorepo.start_command
		? { value: monorepo.start_command, code: true }
		: monorepo.static_output_directory
			? {
					value: `Disajikan sebagai situs statis dari ${monorepo.static_output_directory}`,
					code: false
				}
			: { value: 'Tidak ada script start', code: false };

	return [
		{ label: 'Root workspace', value: root, code: monorepo.root_directory !== REPOSITORY_ROOT },
		{
			label: 'Package',
			value: monorepo.package_name
				? `${monorepo.package_name} (${monorepo.package_directory})`
				: monorepo.package_directory,
			code: true
		},
		{
			label: 'Build command',
			value: monorepo.build_command ?? 'Tidak ada script build',
			code: monorepo.build_command !== null
		},
		{ label: 'Start command', ...start }
	];
}

/** The shape of `stack.monorepo`, which the `deployment.workspace.detected` event repeats. */
const monorepoSchema = z.object({
	manager: z.enum(['npm', 'pnpm', 'yarn', 'bun']),
	root_directory: z.string(),
	package_directory: z.string(),
	package_name: z.string().nullable(),
	build_command: z.string().nullable(),
	start_command: z.string().nullable(),
	static_output_directory: z.string().nullable()
});

export const WORKSPACE_DETECTED_EVENT = 'deployment.workspace.detected';

/**
 * The commands a deployment really used, from its `deployment.workspace.detected` event. Event
 * metadata is free-form, so anything that does not match the documented shape reads as none.
 */
export function parseWorkspaceEventMetadata(metadata: unknown): ProjectMonorepo | null {
	const parsed = monorepoSchema.safeParse(metadata);
	return parsed.success ? parsed.data : null;
}
