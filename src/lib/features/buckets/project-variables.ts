import type { ProjectBucket } from '$lib/features/projects/type';
import { BUCKET_KEY_VARIABLES, BUCKET_VARIABLES } from './variables';

export type BucketVariableRow = {
	name: string;
	/** The project sets a variable with this name itself, and its value wins. */
	overridden: boolean;
};

/**
 * The bucket variables of the attached bucket, in the API's order, each marked when a project
 * variable of the same name takes its place. A name only a newer API sends still shows last.
 */
export function bucketVariableRows(bucket: ProjectBucket): BucketVariableRow[] {
	const injected = new Set(bucket.variables);
	const overridden = new Set(bucket.overridden_variables);
	const known: readonly string[] = BUCKET_VARIABLES;
	const extra = [...injected, ...overridden].filter((name) => !known.includes(name));
	return [...known, ...new Set(extra)]
		.filter((name) => injected.has(name) || overridden.has(name))
		.map((name) => ({ name, overridden: overridden.has(name) }));
}

/** The project's own variable names that override a bucket variable, for the list above. */
export function overriddenBucketNames(buckets: readonly ProjectBucket[] | undefined): Set<string> {
	return new Set(buckets?.flatMap((bucket) => bucket.overridden_variables) ?? []);
}

/**
 * The project overrides the key pair: its own AWS key then signs requests to Sakala's endpoint and
 * bucket, which fail, or the bucket's key reaches another endpoint. Worth a stronger warning.
 */
export function overridesBucketKey(bucket: ProjectBucket): boolean {
	return bucket.overridden_variables.some((name) => BUCKET_KEY_VARIABLES.includes(name));
}
