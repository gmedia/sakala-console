import type { components } from '../generated/schema';

/**
 * How a deployment got its image: built, or reused from the deployment that built it. Kept apart
 * from `deployment.ts`, which loads the HTTP client, so presentation code can read it without one.
 */
export type DeploymentBuild = components['schemas']['DeploymentResource']['build'];
export type DeploymentBuildFallbackReason = components['schemas']['DeploymentBuildFallbackReason'];

export const DEPLOYMENT_BUILD_FALLBACK_REASONS = [
	'image_missing',
	'image_not_owned',
	'image_metadata_missing',
	'invalid_reference',
	'image_unavailable'
] as const satisfies readonly DeploymentBuildFallbackReason[];

/** What the API means by a reason it has no name for, so a newer one still reads as a fallback. */
const UNKNOWN_FALLBACK_REASON = 'image_unavailable' satisfies DeploymentBuildFallbackReason;

/** A fallback reason from the API or an agent event; one this Console does not know is `image_unavailable`. */
export function toFallbackReason(value: unknown): DeploymentBuildFallbackReason {
	return (DEPLOYMENT_BUILD_FALLBACK_REASONS as readonly unknown[]).includes(value)
		? (value as DeploymentBuildFallbackReason)
		: UNKNOWN_FALLBACK_REASON;
}

/** Every deployment of an API from before image reuse was built, so that is what a missing field says. */
export const BUILT_FROM_SCRATCH: DeploymentBuild = {
	mode: 'built',
	image_source_deployment_id: null,
	image_source_sequence: null,
	fallback_reason: null
};
