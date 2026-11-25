import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

/*
 * Managed Valkey stores of a workspace (ADR-023, docs/API_CONVENTIONS.md "Valkey" in sakala-api).
 * The schemas satisfy the generated types and are checked against responses captured from the API
 * in tests/fixtures/valkeys, the same way as buckets. Every endpoint answers 404 while the server's
 * `SAKALA_VALKEY_ENABLED` is off; the Console asks only once `pilot-limits` says `valkeys.enabled`.
 */

type GeneratedValkey = components['schemas']['ValkeyResource'];
type GeneratedAttachment = components['schemas']['ValkeyAttachmentResource'];
type GeneratedCredentials = components['schemas']['ValkeyCredentialsResource'];
type GeneratedPasswordRotation = NonNullable<GeneratedValkey['password_rotation']>;

/** `deleted` never reaches the API's readers, so it is not one the Console shows. */
export const VALKEY_STATUSES = [
	'provisioning',
	'ready',
	'failed',
	'deleting',
	'locked'
] as const satisfies readonly GeneratedValkey['status'][];
export type KnownValkeyStatus = (typeof VALKEY_STATUSES)[number];

/**
 * `cache` evicts the least recently used keys when full and empties on a restart; `persistent`
 * writes an append-only file every second, refuses writes when full, and is backed up nightly.
 * Chosen at creation and fixed.
 */
export const VALKEY_MODE = {
	persistent: 'persistent',
	cache: 'cache'
} as const satisfies Record<string, GeneratedValkey['mode']>;
/** In the order the create page offers them: the recommended one first. */
export const VALKEY_MODES = [VALKEY_MODE.persistent, VALKEY_MODE.cache] as const;
export type ValkeyMode = (typeof VALKEY_MODES)[number];

/** Agent commands that `last_failure.command` names and the Console explains on its own. */
export const VALKEY_COMMANDS = {
	create: 'CreateValkey',
	rotatePassword: 'RotateValkeyPassword',
	resize: 'ResizeValkey'
} as const;

/** `usage.aof_last_write_status` when the node could not write the append-only file. */
export const AOF_WRITE_FAILED = 'err';

/** `last_failure.code` of a persistent store that refused to shrink below its data. */
export const VALKEY_SIZE_BELOW_USAGE = 'valkey_size_below_usage';

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type ValkeyProjectRef = z.output<typeof projectRefSchema>;

const lastFailureSchema = z.object({
	command: z.string(),
	code: z.string(),
	user_fixable: z.boolean(),
	/** Indonesian, written by the API for people. */
	summary: z.string(),
	failed_at: z.string().nullable()
});
export type ValkeyFailure = z.output<typeof lastFailureSchema>;

/** One attached project after a rotation that asked for redeploys. Reasons stay strings. */
const rotationRedeploySchema = z.object({
	project_id: z.string(),
	deployment_id: z.string().nullable(),
	skipped_reason: z.string().nullable()
});
export type ValkeyRotationRedeploy = z.output<typeof rotationRedeploySchema>;

/**
 * The newest password rotation, shaped like a bucket's key rotation. The node closes every logged
 * in connection as soon as it switches, so running apps fail until they are redeployed.
 */
const passwordRotationSchema = z.object({
	status: z.string(),
	requested_at: z.string(),
	completed_at: z.string().nullable(),
	failed_at: z.string().nullable(),
	redeploy_attached: z.boolean(),
	redeploys: z.array(rotationRedeploySchema).nullable()
});
export type ValkeyPasswordRotation = z.output<typeof passwordRotationSchema>;

/** The node's last reading; every field is `null` until it reports one. */
const usageSchema = z.object({
	used_memory_bytes: z.number().nullable(),
	/** Keys evicted since the store started; cache mode only. */
	evicted_keys: z.number().nullable(),
	/** Writes refused because the store was full; persistent mode only. */
	errorstat_oom: z.number().nullable(),
	connected_clients: z.number().nullable(),
	/** `ok` or `err`, persistent mode only. */
	aof_last_write_status: z.string().nullable(),
	/** Docker's state of the store's container, or `missing`. */
	container_status: z.string().nullable(),
	restart_count: z.number().nullable(),
	checked_at: z.string().nullable()
});
export type ValkeyUsage = z.output<typeof usageSchema>;

/**
 * How attached projects reach the store, without the password: an address on the store's private
 * network and port 6379. Every member reads it; it is reachable only from attached projects.
 */
const connectionSchema = z.object({ host: z.string(), port: z.number() });
export type ValkeyConnection = z.output<typeof connectionSchema>;

/* `status`, `mode`, and the rotation's `status` stay plain strings, so a newer value still renders. */
const valkeySchema = z.object({
	id: z.string(),
	name: z.string(),
	mode: z.string(),
	status: z.string(),
	/** Sakala region of the store's node; `null` when that node has none. */
	region: z.string().nullable(),
	maxmemory_mb: z.number(),
	/** A resize on its way to the node; `null` when none is open. */
	pending_maxmemory_mb: z.number().nullable(),
	usage: usageSchema,
	projects: z.array(projectRefSchema),
	/** `null` unless the store is `ready` or `locked`. */
	connection: connectionSchema.nullable(),
	last_failure: lastFailureSchema.nullable(),
	/** `null` when the password was never rotated. */
	password_rotation: passwordRotationSchema.nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<
	Omit<GeneratedValkey, 'status' | 'mode' | 'password_rotation'> & {
		status: string;
		mode: string;
		password_rotation: (Omit<GeneratedPasswordRotation, 'status'> & { status: string }) | null;
	},
	unknown
>;

export type Valkey = z.output<typeof valkeySchema>;

const attachmentSchema = z.object({
	valkey_id: z.string(),
	project: projectRefSchema,
	/** True while the project's serving deployment lacks the store's network and variables. */
	redeploy_required: z.boolean(),
	attached_at: z.string().nullable()
}) satisfies z.ZodType<GeneratedAttachment>;

export type ValkeyAttachment = z.output<typeof attachmentSchema>;

const credentialsSchema = z.object({
	host: z.string(),
	port: z.number(),
	/** The `default` user's password: letters and digits only. */
	password: z.string(),
	/** `redis://:<password>@<host>:6379`, without a database number. */
	url: z.string(),
	/** Exactly what attached projects receive, in the API's order. */
	variables: z.record(z.string(), z.string())
}) satisfies z.ZodType<GeneratedCredentials>;

export type ValkeyCredentials = z.output<typeof credentialsSchema>;

const valkeyListSchema = z.object({ data: z.array(valkeySchema) });
const valkeyResponseSchema = z.object({ data: valkeySchema });
const attachmentResponseSchema = z.object({ data: attachmentSchema });
const credentialsResponseSchema = z.object({ data: credentialsSchema });

export const parseValkeyList = (response: unknown) => valkeyListSchema.parse(response).data;
export const parseValkey = (response: unknown) => valkeyResponseSchema.parse(response).data;
export const parseValkeyAttachment = (response: unknown) =>
	attachmentResponseSchema.parse(response).data;
export const parseValkeyCredentials = (response: unknown) =>
	credentialsResponseSchema.parse(response).data;

const segment = (value: string) => encodeURIComponent(value);
const valkeysPath = (workspaceId: string) =>
	`/api/v1/app/workspaces/${segment(workspaceId)}/valkeys`;
const valkeyPath = (workspaceId: string, valkeyId: string) =>
	`${valkeysPath(workspaceId)}/${segment(valkeyId)}`;

/** Newest first, without pagination: the workspace's quota keeps the list short. */
export async function listValkeys(workspaceId: string): Promise<Valkey[]> {
	return parseValkeyList(await apiRequest<unknown>(valkeysPath(workspaceId)));
}

export async function getValkey(workspaceId: string, valkeyId: string): Promise<Valkey> {
	return parseValkey(await apiRequest<unknown>(valkeyPath(workspaceId, valkeyId)));
}

/*
 * The generated document types `maxmemory_mb` of both request bodies as the strings `"32" | "64" |
 * "128"`: Scramble prints the `in:32,64,128` rule as a string enum. The API validates and sends
 * integers (StoreValkeyRequest), so the Console sends numbers.
 */
type StoreValkeyRequest = Omit<components['schemas']['StoreValkeyRequest'], 'maxmemory_mb'> & {
	maxmemory_mb?: number | null;
};

export type CreateValkeyPayload = Pick<StoreValkeyRequest, 'name' | 'region' | 'maxmemory_mb'> & {
	mode: ValkeyMode;
	/** Created on the node the project runs on and attached to it in the same step. */
	project_id?: string;
};

/** `201`, `provisioning` until the node creates it; the size is reserved at once. */
export async function createValkey(
	workspaceId: string,
	payload: CreateValkeyPayload
): Promise<Valkey> {
	return parseValkey(
		await apiRequest<unknown>(valkeysPath(workspaceId), { method: 'POST', json: payload })
	);
}

/** Rename and resize share one endpoint, at least one of them. The mode never changes. */
export type UpdateValkeyPayload = { name?: string; maxmemory_mb?: number };

/** `200` for a rename, `202` with `pending_maxmemory_mb` when the node has a resize to apply. */
export async function updateValkey(
	workspaceId: string,
	valkeyId: string,
	payload: UpdateValkeyPayload
): Promise<Valkey> {
	return parseValkey(
		await apiRequest<unknown>(valkeyPath(workspaceId, valkeyId), { method: 'PATCH', json: payload })
	);
}

/**
 * `202` with `status: deleting`, or `204` when a store still waiting for the node was removed
 * before it was created. `null` then: there is nothing left to show.
 */
export async function deleteValkey(workspaceId: string, valkeyId: string): Promise<Valkey | null> {
	const response = await apiRequest<unknown>(valkeyPath(workspaceId, valkeyId), {
		method: 'DELETE'
	});
	return response == null ? null : parseValkey(response);
}

/** `201`, or `200` when it was attached already. The project joins the store on its next deploy. */
export async function attachValkey(
	workspaceId: string,
	valkeyId: string,
	projectId: string
): Promise<ValkeyAttachment> {
	return parseValkeyAttachment(
		await apiRequest<unknown>(
			`${valkeyPath(workspaceId, valkeyId)}/attachments/${segment(projectId)}`,
			{ method: 'POST' }
		)
	);
}

/** `204`. The data stays; the project loses the variables and the network on its next deploy. */
export async function detachValkey(
	workspaceId: string,
	valkeyId: string,
	projectId: string
): Promise<void> {
	await apiRequest<void>(`${valkeyPath(workspaceId, valkeyId)}/attachments/${segment(projectId)}`, {
		method: 'DELETE'
	});
}

/**
 * Owners of the workspace and admins only. Every read is written to the audit trail before the
 * password is sent, so the Console reads it only when someone asks, never caches it, and the API
 * answers `Cache-Control: no-store`.
 */
export async function revealValkeyCredentials(
	workspaceId: string,
	valkeyId: string
): Promise<ValkeyCredentials> {
	return parseValkeyCredentials(
		await apiRequest<unknown>(`${valkeyPath(workspaceId, valkeyId)}/credentials`, {
			cache: 'no-store'
		})
	);
}

export type RotateValkeyPasswordPayload = Required<
	components['schemas']['RotateValkeyPasswordRequest']
>;

/**
 * `202` with `password_rotation.status: pending`. The node closes every connection that logged in
 * with the old password; with `redeploy_attached` the API then redeploys the attached projects.
 */
export async function rotateValkeyPassword(
	workspaceId: string,
	valkeyId: string,
	payload: RotateValkeyPasswordPayload
): Promise<Valkey> {
	return parseValkey(
		await apiRequest<unknown>(`${valkeyPath(workspaceId, valkeyId)}/rotate-password`, {
			method: 'POST',
			json: payload
		})
	);
}
