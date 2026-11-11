import type { UpdateProjectPayload } from '../type';

export interface ExecuteRedeployParams {
	project: { id: string; branch?: string | null };
	detailState?: {
		draftName?: string | null;
		draftBranch?: string | null;
		isDirty?: boolean;
		basicsDirty?: boolean;
		configPayload?: () => UpdateProjectPayload;
		resetDraft: () => void;
	} | null;
	updateProject: (payload: { id: string; data: UpdateProjectPayload }) => Promise<unknown>;
	triggerRedeploy: (payload: {
		projectId: string;
		branch: string;
		idempotencyKey?: string;
	}) => void | Promise<unknown>;
}

export async function executeRedeployFlow({
	project,
	detailState,
	updateProject,
	triggerRedeploy
}: ExecuteRedeployParams): Promise<void> {
	const activeBranch = detailState?.draftBranch || project.branch || 'main';

	// Throws before anything is sent when a build field is invalid, and redeploy does not run.
	const configPayload = detailState?.configPayload?.() ?? {};
	const hasConfigChange = Object.keys(configPayload).length > 0;

	if (
		detailState?.isDirty &&
		(detailState.draftName || detailState.draftBranch || hasConfigChange)
	) {
		await updateProject({
			id: project.id,
			data: {
				// A configuration-only draft must not resend the name and branch it did not change.
				...(detailState.basicsDirty !== false && {
					name: detailState.draftName || undefined,
					branch: detailState.draftBranch || undefined
				}),
				...configPayload
			}
		});
		detailState.resetDraft();
	}

	triggerRedeploy({
		projectId: project.id,
		branch: activeBranch,
		idempotencyKey:
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: 'redeploy-' + Date.now()
	});
}

/**
 * The toast after a redeploy is accepted. The page it opens shows the new deployment, but nothing
 * there announces that it started: `DeploymentLiveAnnouncement` only speaks when one finishes.
 */
export function redeployStartedMessage(deployment: { sequence: number; status: string }): string {
	return deployment.status === 'queued'
		? `Redeploy masuk antrean sebagai deployment #${deployment.sequence}.`
		: `Redeploy dimulai sebagai deployment #${deployment.sequence}.`;
}
