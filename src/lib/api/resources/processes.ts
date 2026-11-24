import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

/*
 * Worker processes of a project (ADR-022, docs/API_CONVENTIONS.md "Proses Worker" in sakala-api).
 * The endpoints answer 404 while the installation has workers off; the Console asks only when
 * `workers.enabled` says they are on. Checked against responses captured from the API in
 * tests/fixtures/workloads.
 */

type GeneratedProcess = components['schemas']['ProjectProcessResource'];
type StoreProcessRequest = components['schemas']['StoreProjectProcessRequest'];

/** What the node reports about a crashing worker of the serving deployment. */
const crashSchema = z.object({
	exit_code: z.number().nullable(),
	oom_killed: z.boolean(),
	finished_at: z.string().nullable(),
	restart_count: z.number().nullable(),
	/** True while it is up between two crashes. */
	running: z.boolean().nullable(),
	since: z.string()
});
export type ProcessCrash = z.output<typeof crashSchema>;

const processSchema = z.object({
	id: z.string(),
	name: z.string(),
	command: z.string(),
	/** `0` keeps the definition and runs nothing. */
	replicas: z.number(),
	/** Per container; `null` follows the deployment's. */
	memory_mb: z.number().nullable(),
	cpu_millis: z.number().nullable(),
	crash: crashSchema.nullable(),
	/** Only on the answer to a change. */
	redeploy_required: z.boolean().optional(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<GeneratedProcess>;

export type ProjectProcess = z.output<typeof processSchema>;

const processListSchema = z.object({ data: z.array(processSchema) });
const processResponseSchema = z.object({ data: processSchema });

export const parseProcessList = (response: unknown) => processListSchema.parse(response).data;
export const parseProcess = (response: unknown) => processResponseSchema.parse(response).data;

export type ProcessPayload = Pick<
	StoreProcessRequest,
	'name' | 'command' | 'replicas' | 'memory_mb' | 'cpu_millis'
>;

const segment = (value: string) => encodeURIComponent(value);
const processesPath = (projectId: string) => `/api/v1/app/projects/${segment(projectId)}/processes`;
const processPath = (projectId: string, processId: string) =>
	`${processesPath(projectId)}/${segment(processId)}`;

/** By name. Every member reads them; `crash` is set for a worker of the serving deployment. */
export async function listProcesses(projectId: string): Promise<ProjectProcess[]> {
	return parseProcessList(await apiRequest<unknown>(processesPath(projectId)));
}

/** `201` with `redeploy_required`: the definition runs from the next deployment. */
export async function createProcess(
	projectId: string,
	payload: ProcessPayload
): Promise<ProjectProcess> {
	return parseProcess(
		await apiRequest<unknown>(processesPath(projectId), { method: 'POST', json: payload })
	);
}

export async function updateProcess(
	projectId: string,
	processId: string,
	payload: Partial<ProcessPayload>
): Promise<ProjectProcess> {
	return parseProcess(
		await apiRequest<unknown>(processPath(projectId, processId), { method: 'PATCH', json: payload })
	);
}

/** `204`. Its containers stop with the next deployment. */
export async function deleteProcess(projectId: string, processId: string): Promise<void> {
	await apiRequest<void>(processPath(projectId, processId), { method: 'DELETE' });
}
