import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	assignAdminUserLimitProfile,
	assignAdminWorkspaceLimitProfile,
	createLimitProfile,
	deleteLimitProfile,
	updateAdminUserRole,
	updateAdminUserTeamLimit,
	updateLimitProfile,
	type LimitProfileFields
} from '$lib/api/resources/admin/accounts';
import {
	controlAdminProject,
	type ProjectControlAction,
	type ProjectControlRequest
} from '$lib/api/resources/admin/projects';
import { provisionAgent, revokeAgent, rotateAgentToken } from '$lib/api/resources/admin/agents';
import { updateAdminFeedbackStatus, type FeedbackStatus } from '$lib/api/resources/admin/audit';
import type { WithReason } from '$lib/api/resources/admin/common';

/**
 * Every admin change refreshes every admin read. One change touches several views at once (a
 * project's status shows in the list, the detail, the overview, and the audit log), and admin
 * pages are few and light, so a precise invalidation map would only be a place for bugs to hide.
 */
function createAdminMutation<TVariables, TResult>(
	mutationFn: (variables: TVariables) => Promise<TResult>,
	options: { keepResult?: boolean } = {}
) {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn,
		// A token must not outlive the dialog that shows it, so its result is dropped at once.
		gcTime: options.keepResult === false ? 0 : undefined,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })
	}));
}

export function createProjectControlMutation() {
	return createAdminMutation(
		(input: { id: string; action: ProjectControlAction } & ProjectControlRequest) =>
			controlAdminProject(input.id, input.action, input)
	);
}

export function createUserRoleMutation() {
	return createAdminMutation((input: WithReason & { id: number; role: 'user' | 'admin' }) =>
		updateAdminUserRole(input.id, { role: input.role, reason: input.reason })
	);
}

export function createUserTeamLimitMutation() {
	return createAdminMutation((input: WithReason & { id: number; max_owned_teams: number | null }) =>
		updateAdminUserTeamLimit(input.id, {
			max_owned_teams: input.max_owned_teams,
			reason: input.reason
		})
	);
}

export function createAssignLimitProfileMutation() {
	return createAdminMutation(
		(
			input: WithReason & {
				target: { kind: 'user'; id: number } | { kind: 'workspace'; id: string };
				limit_profile_id: string | null;
			}
		) => {
			const body = { limit_profile_id: input.limit_profile_id, reason: input.reason };
			return input.target.kind === 'user'
				? assignAdminUserLimitProfile(input.target.id, body)
				: assignAdminWorkspaceLimitProfile(input.target.id, body);
		}
	);
}

export function createSaveLimitProfileMutation() {
	return createAdminMutation(
		(input: WithReason & { id: string | null; fields: Partial<LimitProfileFields> }) =>
			input.id === null
				? createLimitProfile({ ...(input.fields as LimitProfileFields), reason: input.reason })
				: updateLimitProfile(input.id, { ...input.fields, reason: input.reason })
	);
}

export function createDeleteLimitProfileMutation() {
	return createAdminMutation((input: WithReason & { id: string }) =>
		deleteLimitProfile(input.id, { reason: input.reason })
	);
}

export function createProvisionAgentMutation() {
	return createAdminMutation(
		(input: WithReason & { name: string; description: string | null }) => provisionAgent(input),
		{ keepResult: false }
	);
}

export function createRotateAgentMutation() {
	return createAdminMutation(
		(input: WithReason & { id: string }) => rotateAgentToken(input.id, { reason: input.reason }),
		{ keepResult: false }
	);
}

export function createRevokeAgentMutation() {
	return createAdminMutation((input: WithReason & { id: string }) =>
		revokeAgent(input.id, { reason: input.reason })
	);
}

export function createFeedbackStatusMutation() {
	return createAdminMutation((input: WithReason & { id: string; status: FeedbackStatus }) =>
		updateAdminFeedbackStatus(input.id, { status: input.status, reason: input.reason })
	);
}
