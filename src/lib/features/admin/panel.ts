import { resolve } from '$app/paths';
import type { PanelStep } from '$lib/components/panel/panel';
import type { AdminProjectDetail } from '$lib/api/resources/admin/projects';
import type { AdminUserDetail, AdminWorkspaceDetail } from '$lib/api/resources/admin/accounts';
import type { AdminAgent } from '$lib/api/resources/admin/agents';
import type { AdminDeployment } from '$lib/api/resources/admin/deployments';

/**
 * The right panel of the admin detail pages (docs/UI_GUIDELINES.md): the same Berikutnya and
 * Bantuan cards as the member pages. For an operator a next step is where to look next about this
 * resource, so each one opens another admin page already filtered to it.
 */
export const ADMIN_PANEL_COPY = {
	label: 'Langkah dan bantuan',
	audit: 'Lihat audit',
	projectFailures: 'Lihat kegagalan proyek',
	limitProfile: 'Buka profil batas',
	personalWorkspace: 'Buka workspace pribadi',
	failedCommands: 'Lihat command gagal',
	similarFailures: 'Lihat kegagalan serupa'
} as const;

/** The audit log filtered to one subject (`AUDIT_ALIASES` names the types the API knows). */
export function auditHref(subjectType: string, subjectId: string): string {
	const query = new URLSearchParams({ subject_type: subjectType, subject_id: subjectId });
	return `${resolve('/admin/audit')}?${query}`;
}

const auditStep = (subjectType: string, subjectId: string): PanelStep => ({
	id: 'audit',
	label: ADMIN_PANEL_COPY.audit,
	href: auditHref(subjectType, subjectId)
});

type ProjectStepDetail = Pick<AdminProjectDetail, 'deployments_count'> & {
	project: Pick<AdminProjectDetail['project'], 'id' | 'slug'>;
};

/**
 * Every failure of the project, then its audit trail. The latest deployment is already a link in
 * the facts, so it is not repeated here.
 */
export function deriveAdminProjectSteps(detail: ProjectStepDetail): PanelStep[] {
	const { project } = detail;
	const steps: PanelStep[] = [];
	if (detail.deployments_count > 0) {
		const query = new URLSearchParams({ range: 'all', search: project.slug });
		steps.push({
			id: 'failures',
			label: ADMIN_PANEL_COPY.projectFailures,
			href: `${resolve('/admin/failures')}?${query}`
		});
	}
	steps.push(auditStep('project', project.id));
	return steps;
}

type UserStepDetail = {
	user: Pick<AdminUserDetail['user'], 'id'>;
	workspaces: Pick<AdminUserDetail['workspaces'][number], 'id' | 'type'>[];
};

export function deriveAdminUserSteps(detail: UserStepDetail): PanelStep[] {
	const personal = detail.workspaces.find((workspace) => workspace.type === 'personal');
	return [
		...(personal
			? [
					{
						id: 'personal-workspace',
						label: ADMIN_PANEL_COPY.personalWorkspace,
						href: resolve(`/admin/workspaces/${personal.id}`)
					}
				]
			: []),
		auditStep('user', String(detail.user.id))
	];
}

type WorkspaceStepDetail = {
	workspace: Pick<AdminWorkspaceDetail['workspace'], 'id' | 'limit_profile'>;
};

export function deriveAdminWorkspaceSteps(detail: WorkspaceStepDetail): PanelStep[] {
	const { workspace } = detail;
	const steps: PanelStep[] = [];
	if (workspace.limit_profile) {
		steps.push({
			id: 'limit-profile',
			label: ADMIN_PANEL_COPY.limitProfile,
			href: resolve(`/admin/limit-profiles/${workspace.limit_profile.id}`)
		});
	}
	steps.push(auditStep('workspace', workspace.id));
	return steps;
}

/** The node's failed commands (the history below, filtered), then its audit trail. */
export function deriveAdminAgentSteps(agent: Pick<AdminAgent, 'id'>): PanelStep[] {
	return [
		{
			id: 'failed-commands',
			label: ADMIN_PANEL_COPY.failedCommands,
			href: `${resolve(`/admin/agents/${agent.id}`)}?status=Failed`
		},
		auditStep('agent_node', agent.id)
	];
}

type DeploymentStepDetail = {
	deployment: Pick<AdminDeployment['deployment'], 'id'> & {
		failure?: { category: string; code: string | null } | null;
	};
};

/** Failures with the same category and code across every project, then the audit trail. */
export function deriveAdminDeploymentSteps(detail: DeploymentStepDetail): PanelStep[] {
	const { deployment } = detail;
	const steps: PanelStep[] = [];
	if (deployment.failure) {
		const query = new URLSearchParams({ range: 'all', category: deployment.failure.category });
		if (deployment.failure.code) query.set('code', deployment.failure.code);
		steps.push({
			id: 'similar',
			label: ADMIN_PANEL_COPY.similarFailures,
			href: `${resolve('/admin/failures')}?${query}`
		});
	}
	steps.push(auditStep('deployment', deployment.id));
	return steps;
}
