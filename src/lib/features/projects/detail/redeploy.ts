export interface ExecuteRedeployParams {
	project: { id: string; branch?: string | null };
	detailState?: {
		draftName?: string | null;
		draftBranch?: string | null;
		isDirty?: boolean;
		resetDraft: () => void;
	} | null;
	updateProject: (payload: {
		id: string;
		data: { name?: string; branch?: string };
	}) => Promise<unknown>;
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

	if (detailState?.isDirty && (detailState.draftName || detailState.draftBranch)) {
		await updateProject({
			id: project.id,
			data: {
				name: detailState.draftName || undefined,
				branch: detailState.draftBranch || undefined
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
