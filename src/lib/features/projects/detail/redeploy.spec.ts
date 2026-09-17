import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRedeployFlow } from './redeploy';

describe('executeRedeployFlow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('project branch main + draft branch develop -> update project develop dan deployment juga harus dikirim dengan branch develop', async () => {
		const updateProject = vi.fn().mockResolvedValue({});
		const triggerRedeploy = vi.fn();
		const resetDraft = vi.fn();

		const detailState = {
			draftName: null,
			draftBranch: 'develop',
			isDirty: true,
			resetDraft
		};

		await executeRedeployFlow({
			project: { id: 'proj-123', branch: 'main' },
			detailState,
			updateProject,
			triggerRedeploy
		});

		expect(updateProject).toHaveBeenCalledWith({
			id: 'proj-123',
			data: {
				name: undefined,
				branch: 'develop'
			}
		});

		expect(resetDraft).toHaveBeenCalledTimes(1);

		expect(triggerRedeploy).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'proj-123',
				branch: 'develop'
			})
		);
	});

	it('updates both draftName and draftBranch before triggering redeploy with draft branch', async () => {
		const updateProject = vi.fn().mockResolvedValue({});
		const triggerRedeploy = vi.fn();
		const resetDraft = vi.fn();

		const detailState = {
			draftName: 'New Project Name',
			draftBranch: 'feature/login',
			isDirty: true,
			resetDraft
		};

		await executeRedeployFlow({
			project: { id: 'proj-456', branch: 'main' },
			detailState,
			updateProject,
			triggerRedeploy
		});

		expect(updateProject).toHaveBeenCalledWith({
			id: 'proj-456',
			data: {
				name: 'New Project Name',
				branch: 'feature/login'
			}
		});
		expect(resetDraft).toHaveBeenCalledTimes(1);
		expect(triggerRedeploy).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'proj-456',
				branch: 'feature/login'
			})
		);
	});

	it('triggers redeploy with existing project branch when there is no draft changes', async () => {
		const updateProject = vi.fn();
		const triggerRedeploy = vi.fn();
		const resetDraft = vi.fn();

		const detailState = {
			draftName: null,
			draftBranch: null,
			isDirty: false,
			resetDraft
		};

		await executeRedeployFlow({
			project: { id: 'proj-789', branch: 'staging' },
			detailState,
			updateProject,
			triggerRedeploy
		});

		expect(updateProject).not.toHaveBeenCalled();
		expect(resetDraft).not.toHaveBeenCalled();
		expect(triggerRedeploy).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'proj-789',
				branch: 'staging'
			})
		);
	});

	it('does NOT reset draft or trigger redeploy if updating project fails', async () => {
		const error = new Error('Network failure');
		const updateProject = vi.fn().mockRejectedValue(error);
		const triggerRedeploy = vi.fn();
		const resetDraft = vi.fn();

		const detailState = {
			draftName: null,
			draftBranch: 'develop',
			isDirty: true,
			resetDraft
		};

		await expect(
			executeRedeployFlow({
				project: { id: 'proj-123', branch: 'main' },
				detailState,
				updateProject,
				triggerRedeploy
			})
		).rejects.toThrow('Network failure');

		expect(resetDraft).not.toHaveBeenCalled();
		expect(triggerRedeploy).not.toHaveBeenCalled();
	});
});
