import { z } from 'zod';
import { apiRequest } from '../../client';
import {
	paginated,
	projectRefSchema,
	single,
	type Paginated,
	type QueryParams,
	type WithReason
} from './common';

export const adminAgentSchema = z.object({
	id: z.string(),
	agent_id: z.string(),
	/** The column is nullable: a node registered before names were required has none. */
	name: z.string().nullable(),
	description: z.string().nullable(),
	token_prefix: z.string().nullable(),
	auth_status: z.string(),
	status: z.string(),
	desired_state: z.string(),
	protocol_version: z.number().nullable(),
	agent_version: z.string().nullable(),
	hostname: z.string().nullable(),
	runtime_network: z.string().nullable(),
	capabilities: z.array(z.string()),
	active_workload_count: z.number().optional(),
	open_commands_count: z.number().optional(),
	registered_at: z.string().nullable(),
	last_seen_at: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
});

export type AdminAgent = z.infer<typeof adminAgentSchema>;

const reportSchema = z.object({
	sequence: z.number(),
	kind: z.string(),
	level: z.string().nullable(),
	stream: z.string().nullable(),
	type: z.string().nullable(),
	message: z.string(),
	metadata: z.unknown().nullable(),
	occurred_at: z.string().nullable()
});

export const agentCommandSchema = z.object({
	id: z.string(),
	type: z.string(),
	status: z.string(),
	project: projectRefSchema.nullable(),
	deployment_id: z.string().nullable(),
	attempts: z.number(),
	error_code: z.string().nullable(),
	error_message: z.string().nullable(),
	created_at: z.string().nullable(),
	claimed_at: z.string().nullable(),
	started_at: z.string().nullable(),
	completed_at: z.string().nullable(),
	failed_at: z.string().nullable(),
	cancel_requested_at: z.string().nullable(),
	duration_seconds: z.number().nullable(),
	reports_count: z.number().optional(),
	reports: z.array(reportSchema).optional()
});

export type AgentCommand = z.infer<typeof agentCommandSchema>;

const provisionedSchema = z.object({ agent: adminAgentSchema, token: z.string().min(1) });

/** The token exists in this response only. Keep it out of any cache. */
export type ProvisionedAgent = z.infer<typeof provisionedSchema>;

const agentListSchema = paginated(adminAgentSchema);
const agentResponseSchema = single(adminAgentSchema);
const commandListSchema = paginated(agentCommandSchema);
const commandResponseSchema = single(agentCommandSchema);
const provisionedResponseSchema = single(provisionedSchema);

export const parseAdminAgents = (r: unknown): Paginated<AdminAgent> => agentListSchema.parse(r);
export const parseAdminAgent = (r: unknown): AdminAgent => agentResponseSchema.parse(r).data;
export const parseAgentCommands = (r: unknown): Paginated<AgentCommand> =>
	commandListSchema.parse(r);
export const parseAgentCommand = (r: unknown): AgentCommand => commandResponseSchema.parse(r).data;
export const parseProvisionedAgent = (r: unknown): ProvisionedAgent =>
	provisionedResponseSchema.parse(r).data;

const AGENTS = 'api/v1/admin/agents';

/** `search` (name, agent ID, hostname), `status`, `auth_status`, `never_seen` (`1`). */
export async function listAdminAgents(params: QueryParams) {
	return parseAdminAgents(await apiRequest<unknown>(AGENTS, { params }));
}

export async function getAdminAgent(id: string) {
	return parseAdminAgent(await apiRequest<unknown>(`${AGENTS}/${id}`));
}

/** `201` with the node and its token, shown this once. */
export async function provisionAgent(
	body: WithReason & { name: string; description: string | null }
) {
	return parseProvisionedAgent(await apiRequest<unknown>(AGENTS, { method: 'POST', json: body }));
}

/** A new token, shown once. The old one stops working at once. */
export async function rotateAgentToken(id: string, body: WithReason) {
	return parseProvisionedAgent(
		await apiRequest<unknown>(`${AGENTS}/${id}/rotate`, { method: 'POST', json: body })
	);
}

/** The node can no longer authenticate or receive commands. Repeating it changes nothing. */
export async function revokeAgent(id: string, body: WithReason) {
	return parseAdminAgent(
		await apiRequest<unknown>(`${AGENTS}/${id}/revoke`, { method: 'POST', json: body })
	);
}

/** `type`, `status`, `page`, `per_page`. Payloads are never part of the response. */
export async function listAgentCommands(id: string, params: QueryParams) {
	return parseAgentCommands(await apiRequest<unknown>(`${AGENTS}/${id}/commands`, { params }));
}

/** The command with up to 200 of its newest reports, oldest first. */
export async function getAgentCommand(agentId: string, commandId: string) {
	return parseAgentCommand(await apiRequest<unknown>(`${AGENTS}/${agentId}/commands/${commandId}`));
}
