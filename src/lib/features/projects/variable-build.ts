import type { components } from '$lib/api/generated/schema';
import type { Project, VariableChanges } from './type';

/**
 * Why a variable change makes the next redeploy build instead of reusing the live image
 * (sakala-api `VariableBuildReason`). The first three describe the whole project, so the API sends
 * them as `variable_changes.reason`; `build_time_prefix` is per variable, which the Console works
 * out itself from `build_time_prefixes` / `build_time_keys`.
 */
export const VARIABLE_BUILD_REASONS = {
	staticSite: 'static_site',
	prerenderFramework: 'prerender_framework',
	unknownStack: 'unknown_stack',
	buildTimePrefix: 'build_time_prefix'
} as const satisfies Record<string, VariableBuildReason>;

export type VariableBuildReason = components['schemas']['VariableBuildReason'];

type ProjectBuildReason = Exclude<VariableBuildReason, 'build_time_prefix'>;

/** Where a variable comes from. Variables Sakala injects from the attached database never build. */
export const VARIABLE_SOURCES = { project: 'project', database: 'database' } as const;
export type VariableSource = (typeof VARIABLE_SOURCES)[keyof typeof VARIABLE_SOURCES];

/** One variable the user is about to add, change, or delete. */
export type VariableChange = { key: string; source: VariableSource };

export type VariableBuildDecision =
	| { needsBuild: false }
	| { needsBuild: true; reason: ProjectBuildReason }
	/** `prefix` is the matched prefix; `null` when the whole key is build-time, such as NODE_ENV. */
	| { needsBuild: true; reason: 'build_time_prefix'; key: string; prefix: string | null };

export type VariableBuildProject = Pick<Project, 'variable_changes' | 'active_deployment_id'>;

/**
 * The build-time list of sakala-api before `variable_changes` existed (v0.9.0), used only when an
 * older API leaves the field out. With it, a key outside the list gets no hint at all: that API
 * reuses the image even for a static site, so "tanpa build" would be true but would not tell the
 * user their change may not show.
 */
const LEGACY_BUILD_TIME_VARIABLES: Pick<
	VariableChanges,
	'build_time_prefixes' | 'build_time_keys'
> = {
	build_time_prefixes: [
		'NEXT_PUBLIC_',
		'NUXT_PUBLIC_',
		'VITE_',
		'REACT_APP_',
		'VUE_APP_',
		'GATSBY_',
		'EXPO_PUBLIC_',
		'PUBLIC_',
		'RAILPACK_'
	],
	build_time_keys: ['NODE_ENV']
};

const PROJECT_BUILD_REASONS: readonly string[] = [
	VARIABLE_BUILD_REASONS.staticSite,
	VARIABLE_BUILD_REASONS.prerenderFramework,
	VARIABLE_BUILD_REASONS.unknownStack
];

function isProjectBuildReason(reason: unknown): reason is ProjectBuildReason {
	return typeof reason === 'string' && PROJECT_BUILD_REASONS.includes(reason);
}

/** The first key the build reads, in the order of the changes; prefixes match case-sensitively. */
function findBuildTimeKey(
	keys: readonly string[],
	list: Pick<VariableChanges, 'build_time_prefixes' | 'build_time_keys'>
): VariableBuildDecision | null {
	for (const key of keys) {
		if (list.build_time_keys.includes(key)) {
			return {
				needsBuild: true,
				reason: VARIABLE_BUILD_REASONS.buildTimePrefix,
				key,
				prefix: null
			};
		}
		const prefix = list.build_time_prefixes.find((candidate) => key.startsWith(candidate));
		if (prefix !== undefined) {
			return { needsBuild: true, reason: VARIABLE_BUILD_REASONS.buildTimePrefix, key, prefix };
		}
	}
	return null;
}

/**
 * What the next redeploy does because of these variable changes: a full build, or the live image
 * again. A batch builds as soon as one key needs it. `null` means there is nothing true and useful
 * to say: no change, no live image to reuse (every deploy builds then), or an older API that does
 * not say how it decides.
 */
export function decideVariableBuild(
	project: VariableBuildProject | null | undefined,
	changes: readonly VariableChange[]
): VariableBuildDecision | null {
	if (!project || changes.length === 0) return null;

	const reuse: VariableBuildDecision | null = project.active_deployment_id
		? { needsBuild: false }
		: null;
	const projectKeys = changes
		.filter((change) => change.source === VARIABLE_SOURCES.project)
		.map((change) => change.key);
	// The database's own variables are runtime only: builds cannot reach the database.
	if (projectKeys.length === 0) return reuse;

	const policy = project.variable_changes;
	if (!policy) return findBuildTimeKey(projectKeys, LEGACY_BUILD_TIME_VARIABLES);

	if (policy.requires_build) {
		return {
			needsBuild: true,
			// A build without a reason the Console knows is still a build; say we cannot tell why.
			reason: isProjectBuildReason(policy.reason)
				? policy.reason
				: VARIABLE_BUILD_REASONS.unknownStack
		};
	}
	return findBuildTimeKey(projectKeys, policy) ?? reuse;
}

/** The project's own variables, as changes. */
export function projectVariableChanges(keys: readonly string[]): VariableChange[] {
	return keys.map((key) => ({ key, source: VARIABLE_SOURCES.project }));
}
