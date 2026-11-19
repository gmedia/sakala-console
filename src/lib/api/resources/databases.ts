import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

/*
 * Managed PostgreSQL databases of a workspace (ADR-020, docs/API_CONVENTIONS.md "Database" in
 * sakala-api). The schemas satisfy the generated types and are checked against responses captured
 * from the API in tests/fixtures/databases.
 */

type GeneratedDatabase = components['schemas']['DatabaseResource'];
type GeneratedAttachment = components['schemas']['DatabaseAttachmentResource'];
type GeneratedCredentials = components['schemas']['DatabaseCredentialsResource'];

/** The allow-list the API accepts on `POST .../extensions`, in the order it documents them. */
export const DATABASE_EXTENSIONS = [
	'pgcrypto',
	'citext',
	'pg_trgm',
	'unaccent',
	'hstore',
	'vector'
] as const satisfies readonly components['schemas']['DatabaseExtension'][];
export type DatabaseExtension = (typeof DATABASE_EXTENSIONS)[number];

/** `deleted` never reaches the API's readers, so it is not one the Console shows. */
export const DATABASE_STATUSES = [
	'provisioning',
	'ready',
	'failed',
	'deleting',
	'locked'
] as const satisfies readonly GeneratedDatabase['status'][];
export type KnownDatabaseStatus = (typeof DATABASE_STATUSES)[number];

/** Agent commands `last_failure.command` names that the Console explains on its own. */
export const DATABASE_COMMANDS = {
	create: 'CreateDatabase',
	rotatePassword: 'RotateDatabasePassword',
	installExtension: 'InstallDatabaseExtension'
} as const;

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type DatabaseProjectRef = z.output<typeof projectRefSchema>;

const lastFailureSchema = z.object({
	command: z.string(),
	code: z.string(),
	user_fixable: z.boolean(),
	/** Indonesian, written by the API for people. */
	summary: z.string(),
	failed_at: z.string().nullable()
});
export type DatabaseFailure = z.output<typeof lastFailureSchema>;

/*
 * `status` and `engine` stay plain strings, as the API client docs ask for enums that are shown: a
 * value added by a newer API still renders, and the label has a fallback.
 */
const databaseSchema = z.object({
	id: z.string(),
	name: z.string(),
	engine: z.string(),
	status: z.string(),
	region: z.string().nullable(),
	size_bytes: z.number().nullable(),
	size_checked_at: z.string().nullable(),
	projects: z.array(projectRefSchema),
	last_failure: lastFailureSchema.nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<Omit<GeneratedDatabase, 'status' | 'engine'> & { status: string }>;

export type Database = z.output<typeof databaseSchema>;

const attachmentSchema = z.object({
	database_id: z.string(),
	project: projectRefSchema,
	/** True while the project's serving deployment lacks the connection variables. */
	redeploy_required: z.boolean(),
	attached_at: z.string().nullable()
}) satisfies z.ZodType<GeneratedAttachment>;

export type DatabaseAttachment = z.output<typeof attachmentSchema>;

const credentialsSchema = z.object({
	/** On the private network of the runtime nodes; `null` until the database node reports it. */
	host: z.string().nullable(),
	port: z.number().nullable(),
	database: z.string(),
	username: z.string(),
	password: z.string(),
	/** The same value as `DATABASE_URL`; `null` until the node reports its address. */
	url: z.string().nullable(),
	sslmode: z.string()
}) satisfies z.ZodType<GeneratedCredentials>;

export type DatabaseCredentials = z.output<typeof credentialsSchema>;

const databaseListSchema = z.object({ data: z.array(databaseSchema) });
const databaseResponseSchema = z.object({ data: databaseSchema });
const attachmentResponseSchema = z.object({ data: attachmentSchema });
const credentialsResponseSchema = z.object({ data: credentialsSchema });

export const parseDatabaseList = (response: unknown) => databaseListSchema.parse(response).data;
export const parseDatabase = (response: unknown) => databaseResponseSchema.parse(response).data;
export const parseAttachment = (response: unknown) => attachmentResponseSchema.parse(response).data;
export const parseCredentials = (response: unknown) =>
	credentialsResponseSchema.parse(response).data;

const segment = (value: string) => encodeURIComponent(value);
const databasesPath = (workspaceId: string) =>
	`/api/v1/app/workspaces/${segment(workspaceId)}/databases`;
const databasePath = (workspaceId: string, databaseId: string) =>
	`${databasesPath(workspaceId)}/${segment(databaseId)}`;

/** Newest first, without pagination: the workspace's quota keeps the list short. */
export async function listDatabases(workspaceId: string): Promise<Database[]> {
	return parseDatabaseList(await apiRequest<unknown>(databasesPath(workspaceId)));
}

export type CreateDatabasePayload = Pick<
	components['schemas']['StoreDatabaseRequest'],
	'name' | 'region'
>;

/** `201`, `provisioning` until the database node creates it. `region: null` lets the API pick. */
export async function createDatabase(
	workspaceId: string,
	payload: CreateDatabasePayload
): Promise<Database> {
	return parseDatabase(
		await apiRequest<unknown>(databasesPath(workspaceId), { method: 'POST', json: payload })
	);
}

export async function getDatabase(workspaceId: string, databaseId: string): Promise<Database> {
	return parseDatabase(await apiRequest<unknown>(databasePath(workspaceId, databaseId)));
}

export async function renameDatabase(
	workspaceId: string,
	databaseId: string,
	name: string
): Promise<Database> {
	return parseDatabase(
		await apiRequest<unknown>(databasePath(workspaceId, databaseId), {
			method: 'PATCH',
			json: { name }
		})
	);
}

/** `202` with `status: deleting`; the database leaves the API once the node drops it. */
export async function deleteDatabase(workspaceId: string, databaseId: string): Promise<Database> {
	return parseDatabase(
		await apiRequest<unknown>(databasePath(workspaceId, databaseId), { method: 'DELETE' })
	);
}

/** `201`, or `200` when it was attached already. The project receives the variables on its next deploy. */
export async function attachDatabase(
	workspaceId: string,
	databaseId: string,
	projectId: string
): Promise<DatabaseAttachment> {
	return parseAttachment(
		await apiRequest<unknown>(
			`${databasePath(workspaceId, databaseId)}/attachments/${segment(projectId)}`,
			{ method: 'POST' }
		)
	);
}

/** `204`. The data stays; the project loses the variables on its next deploy. */
export async function detachDatabase(
	workspaceId: string,
	databaseId: string,
	projectId: string
): Promise<void> {
	await apiRequest<void>(
		`${databasePath(workspaceId, databaseId)}/attachments/${segment(projectId)}`,
		{ method: 'DELETE' }
	);
}

/**
 * Owners of the workspace and admins only. Every read is written to the audit trail before the
 * password is sent, so the Console reads it only when someone asks, and never caches it.
 */
export async function getDatabaseCredentials(
	workspaceId: string,
	databaseId: string
): Promise<DatabaseCredentials> {
	return parseCredentials(
		await apiRequest<unknown>(`${databasePath(workspaceId, databaseId)}/credentials`, {
			cache: 'no-store'
		})
	);
}

/** `202`. The old password keeps working until the node reports the new one. */
export async function rotateDatabasePassword(
	workspaceId: string,
	databaseId: string
): Promise<Database> {
	return parseDatabase(
		await apiRequest<unknown>(`${databasePath(workspaceId, databaseId)}/rotate-password`, {
			method: 'POST'
		})
	);
}

/** `202`. The result reaches the audit trail, and a failure `last_failure`. */
export async function installDatabaseExtension(
	workspaceId: string,
	databaseId: string,
	extension: DatabaseExtension
): Promise<Database> {
	return parseDatabase(
		await apiRequest<unknown>(`${databasePath(workspaceId, databaseId)}/extensions`, {
			method: 'POST',
			json: { extension }
		})
	);
}
