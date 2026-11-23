import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRedeployFlow, redeployStartedMessage } from './redeploy';

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

	it('saves a build setting that was edited alone, without resending name and branch', async () => {
		const updateProject = vi.fn().mockResolvedValue({});
		const triggerRedeploy = vi.fn();
		const resetDraft = vi.fn();

		await executeRedeployFlow({
			project: { id: 'proj-123', branch: 'main' },
			detailState: {
				draftName: null,
				draftBranch: null,
				isDirty: true,
				basicsDirty: false,
				configPayload: () => ({ configured_port: 8080 }),
				resetDraft
			},
			updateProject,
			triggerRedeploy
		});

		expect(updateProject).toHaveBeenCalledWith({
			id: 'proj-123',
			data: { configured_port: 8080 }
		});
		expect(resetDraft).toHaveBeenCalledOnce();
		expect(triggerRedeploy).toHaveBeenCalledOnce();
	});

	it('does not deploy when a build setting in the draft is invalid', async () => {
		const updateProject = vi.fn();
		const triggerRedeploy = vi.fn();

		await expect(
			executeRedeployFlow({
				project: { id: 'proj-123', branch: 'main' },
				detailState: {
					isDirty: true,
					configPayload: () => {
						throw new Error('invalid');
					},
					resetDraft: vi.fn()
				},
				updateProject,
				triggerRedeploy
			})
		).rejects.toThrow('invalid');

		expect(updateProject).not.toHaveBeenCalled();
		expect(triggerRedeploy).not.toHaveBeenCalled();
	});
});

describe('executeRedeployFlow and the image', () => {
	it('sends no forceBuild by default, so the API decides whether to reuse the live image', async () => {
		const triggerRedeploy = vi.fn();

		await executeRedeployFlow({
			project: { id: 'proj-1', branch: 'main' },
			updateProject: vi.fn(),
			triggerRedeploy
		});

		expect(triggerRedeploy).toHaveBeenCalledOnce();
		expect(triggerRedeploy.mock.calls[0][0]).not.toHaveProperty('forceBuild');
	});

	it('asks for a full build when "Build ulang dari awal" was chosen', async () => {
		const triggerRedeploy = vi.fn();

		await executeRedeployFlow({
			project: { id: 'proj-1', branch: 'main' },
			updateProject: vi.fn(),
			triggerRedeploy,
			forceBuild: true
		});

		expect(triggerRedeploy).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'proj-1', branch: 'main', forceBuild: true })
		);
	});
});

describe('redeployStartedMessage', () => {
	it('says a queued redeploy is waiting, and names the new deployment', () => {
		expect(redeployStartedMessage({ sequence: 12, status: 'queued' })).toBe(
			'Redeploy masuk antrean sebagai deployment #12.'
		);
	});

	it("calls a project's first deployment a deploy, not a redeploy", () => {
		expect(redeployStartedMessage({ sequence: 1, status: 'queued' })).toBe(
			'Deploy masuk antrean sebagai deployment #1.'
		);
		expect(redeployStartedMessage({ sequence: 1, status: 'cloning' })).toBe(
			'Deploy dimulai sebagai deployment #1.'
		);
	});

	it('says one that already left the queue has started', () => {
		expect(redeployStartedMessage({ sequence: 13, status: 'cloning' })).toBe(
			'Redeploy dimulai sebagai deployment #13.'
		);
	});

	it('says when the API plans to reuse an image, since that is why it will be quick', () => {
		expect(
			redeployStartedMessage({
				sequence: 14,
				status: 'queued',
				build: {
					mode: 'reused',
					image_source_deployment_id: 'dep-12',
					image_source_sequence: 12,
					fallback_reason: null
				}
			})
		).toBe(
			'Redeploy masuk antrean sebagai deployment #14, tanpa build, memakai image deployment #12.'
		);
	});
});
