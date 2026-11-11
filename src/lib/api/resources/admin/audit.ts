import { z } from 'zod';
import { apiRequest } from '../../client';
import { paginated, single, type Paginated, type QueryParams, type WithReason } from './common';

/** PHP sends an empty map as `[]`; both mean "nothing recorded". */
const metadataSchema = z
	.union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
	.nullable()
	.transform((value) => (value === null || Array.isArray(value) ? {} : value));

export const auditEventSchema = z.object({
	id: z.number(),
	action: z.string(),
	actor: z.object({
		type: z.string().nullable(),
		id: z.string().nullable(),
		name: z.string().nullable(),
		username: z.string().nullable()
	}),
	subject: z.object({ type: z.string().nullable(), id: z.string().nullable() }),
	metadata: metadataSchema,
	ip_address: z.string().nullable(),
	user_agent: z.string().nullable(),
	created_at: z.string().nullable()
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const AUDIT_ALIASES = [
	'user',
	'project',
	'deployment',
	'workspace',
	'limit_profile',
	'agent_node',
	'agent_command',
	'feedback',
	'usage_signal',
	'system',
	'github_app',
	'github_installation'
] as const;

const auditListSchema = paginated(auditEventSchema);

export const parseAuditEvents = (r: unknown): Paginated<AuditEvent> => auditListSchema.parse(r);

/** `actor_type` + `actor_id`, `action` (exact), `subject_type` + `subject_id`, and a range (default all). */
export async function listAuditEvents(params: QueryParams) {
	return parseAuditEvents(await apiRequest<unknown>('api/v1/admin/audit-events', { params }));
}

export const adminFeedbackSchema = z.object({
	id: z.string(),
	category: z.string(),
	status: z.enum(['open', 'acknowledged', 'resolved']),
	message: z.string(),
	consent: z.boolean(),
	user: z.object({ id: z.number(), name: z.string(), username: z.string(), email: z.string() }),
	project: z
		.object({ id: z.string(), name: z.string(), slug: z.string(), deleted: z.boolean() })
		.nullable(),
	deployment_id: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
});

export type AdminFeedback = z.infer<typeof adminFeedbackSchema>;
export type FeedbackStatus = AdminFeedback['status'];

const feedbackListSchema = paginated(adminFeedbackSchema);
const feedbackResponseSchema = single(adminFeedbackSchema);

export const parseAdminFeedbackList = (r: unknown): Paginated<AdminFeedback> =>
	feedbackListSchema.parse(r);
export const parseAdminFeedback = (r: unknown): AdminFeedback =>
	feedbackResponseSchema.parse(r).data;

/** `status`, `category`, `search` (in the message), `page`, `per_page`. */
export async function listAdminFeedback(params: QueryParams) {
	return parseAdminFeedbackList(await apiRequest<unknown>('api/v1/admin/feedback', { params }));
}

export async function updateAdminFeedbackStatus(
	id: string,
	body: WithReason & { status: FeedbackStatus }
) {
	return parseAdminFeedback(
		await apiRequest<unknown>(`api/v1/admin/feedback/${id}`, { method: 'PATCH', json: body })
	);
}
