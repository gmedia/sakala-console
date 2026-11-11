import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../client';
import { apiErrorFromResponse } from '../../errors';
import { parseAdminOverview } from './overview';
import {
	parseAdminUser,
	parseAdminUserDetail,
	parseAdminUsers,
	parseAdminWorkspace,
	parseAdminWorkspaceDetail,
	parseAdminWorkspaces,
	parseLimitProfile,
	parseLimitProfiles,
	deleteLimitProfile,
	listAdminUsers
} from './accounts';
import { parseAdminFeedback, parseAdminFeedbackList, parseAuditEvents } from './audit';
import {
	controlAdminProject,
	parseAdminProjectDetail,
	parseAdminProjects,
	parseProjectControlResult
} from './projects';
import {
	getAdminDeploymentLogs,
	parseAdminDeployment,
	parseFailedDeployments,
	parseFailureSummary
} from './deployments';
import {
	parseAdminAgent,
	parseAdminAgents,
	parseAgentCommand,
	parseAgentCommands,
	parseProvisionedAgent
} from './agents';
import { parseDeploymentEventsResponse, parseDeploymentLogsResponse } from '../deployment';

vi.mock('../../client', () => ({ apiRequest: vi.fn() }));

/**
 * Every fixture is a response the merged sakala-api (ecbca92) sent from its own factories, captured
 * by a throwaway Pest test. Only debug traces were removed and the one-time tokens replaced.
 */
const fixtures = import.meta.glob<{ status: number; body: unknown }>(
	'../../../../../tests/fixtures/admin/*.json',
	{ eager: true, import: 'default' }
);

function fixture(name: string) {
	const entry = fixtures[`../../../../../tests/fixtures/admin/${name}.json`];
	if (!entry) throw new Error(`fixture ${name} is missing`);
	return entry;
}

const parsers: Record<string, (body: unknown) => unknown> = {
	overview: parseAdminOverview,
	'overview-custom': parseAdminOverview,
	users: parseAdminUsers,
	'user-detail': parseAdminUserDetail,
	'user-role': parseAdminUser,
	'user-team-limit': parseAdminUser,
	'user-limit-profile': parseAdminWorkspace,
	workspaces: parseAdminWorkspaces,
	'workspace-detail': parseAdminWorkspaceDetail,
	'workspace-limit-profile': parseAdminWorkspace,
	'limit-profiles': parseLimitProfiles,
	'limit-profile-create': parseLimitProfile,
	'limit-profile-update': parseLimitProfile,
	projects: parseAdminProjects,
	'project-detail': parseAdminProjectDetail,
	'project-detail-suspended': parseAdminProjectDetail,
	'project-stop': parseProjectControlResult,
	'project-suspend': parseProjectControlResult,
	'project-unsuspend': parseProjectControlResult,
	'project-reconcile': parseProjectControlResult,
	failures: parseFailedDeployments,
	'failure-summary': parseFailureSummary,
	'failure-summary-all': parseFailureSummary,
	'deployment-detail': parseAdminDeployment,
	'deployment-events': parseDeploymentEventsResponse,
	'deployment-logs': parseDeploymentLogsResponse,
	agents: parseAdminAgents,
	'agent-detail': parseAdminAgent,
	'agent-revoke': parseAdminAgent,
	'agent-commands': parseAgentCommands,
	'agent-command': parseAgentCommand,
	'agent-provision': parseProvisionedAgent,
	'agent-rotate': parseProvisionedAgent,
	feedback: parseAdminFeedbackList,
	'feedback-update': parseAdminFeedback,
	'audit-events': parseAuditEvents
};

describe('admin schemas against real API responses', () => {
	for (const [name, parse] of Object.entries(parsers)) {
		it(`parses ${name}`, () => {
			const { status, body } = fixture(name);
			expect(status).toBeLessThan(300);
			expect(() => parse(body)).not.toThrow();
		});
	}

	it('covers every successful fixture, so a new capture cannot go unchecked', () => {
		const successful = Object.entries(fixtures)
			.filter(([, value]) => value.status < 300)
			.map(([path]) => path.split('/').at(-1)!.replace('.json', ''))
			.filter((name) => name !== 'current-user');
		expect(successful.sort()).toEqual(Object.keys(parsers).sort());
	});

	it('reads the overview range as whole WIB days, with the previous window for trends', () => {
		const overview = parseAdminOverview(fixture('overview').body);
		expect(overview.range).toEqual({
			key: '7d',
			from: '2026-11-04T17:00:00+00:00',
			to: '2026-11-11T17:00:00+00:00',
			timezone: 'Asia/Jakarta'
		});
		expect(overview.user_growth).toHaveLength(7);
		expect(overview.new_user_sources.at(-1)?.source).toBeNull();
	});

	it('keeps the one-time token on provisioning and never on the node itself', () => {
		const provisioned = parseProvisionedAgent(fixture('agent-provision').body);
		expect(provisioned.token).toMatch(/^sk_agt_/);
		expect(provisioned.agent).not.toHaveProperty('token');
	});

	it('reads empty audit metadata, which PHP sends as a list, as an empty map', () => {
		const events = parseAuditEvents({
			data: [
				{
					...(fixture('audit-events').body as { data: object[] }).data[0],
					metadata: []
				}
			],
			meta: { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 1, total: 1 }
		});
		expect(events.data[0].metadata).toEqual({});
	});

	it('reads a node registered before names were required, whose name is null', () => {
		const body = fixture('agents').body as { data: object[]; meta: object };
		const agents = parseAdminAgents({ ...body, data: [{ ...body.data[0], name: null }] });
		expect(agents.data[0].name).toBeNull();
	});

	it('refuses a list without pagination, instead of inventing a page count', () => {
		expect(() => parseAdminUsers({ data: [] })).toThrow();
	});
});

describe('admin error bodies', () => {
	it('keeps the stable code and the API text of the limit profile conflict', () => {
		const { status, body } = fixture('limit-profile-delete-in-use');
		const payload = body as { message: string; code: string };
		const error = apiErrorFromResponse(status, { apiMessage: payload.message, code: payload.code });
		expect(error.status).toBe(409);
		expect(error.code).toBe('LIMIT_PROFILE_IN_USE');
		expect(error.message).toContain('masih dipakai workspace');
	});

	it('shows the self-demotion refusal as the API words it', () => {
		const { status, body } = fixture('user-role-self');
		const payload = body as { message: string; code: string };
		const error = apiErrorFromResponse(status, { apiMessage: payload.message, code: payload.code });
		expect(error.code).toBe('ADMIN_SELF_DEMOTION');
		expect(error.message).toMatch(/^Kamu tidak bisa/);
	});

	it('shows a project control conflict without a code as its message', () => {
		const { status, body } = fixture('project-stop-again');
		const error = apiErrorFromResponse(status, {
			apiMessage: (body as { message: string }).message
		});
		expect(error.message).toBe('Command stop proyek ini masih berjalan. Tunggu sampai selesai.');
	});

	it('hides the framework text of a non-admin refusal', () => {
		const { status, body } = fixture('forbidden');
		const error = apiErrorFromResponse(status, {
			apiMessage: (body as { message: string }).message
		});
		expect(error.isForbidden).toBe(true);
		expect(error.message).not.toContain('unauthorized');
	});

	it('identifies an admin by the role on the current user', () => {
		const { body } = fixture('current-user');
		expect((body as { data: { role: string } }).data.role).toBe('admin');
	});
});

describe('admin requests', () => {
	beforeEach(() => vi.mocked(apiRequest).mockReset());

	it('sends list filters as query parameters', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(fixture('users').body);
		await listAdminUsers({ page: 2, search: 'rani', verified: '0' });
		expect(apiRequest).toHaveBeenCalledWith('api/v1/admin/users', {
			params: { page: 2, search: 'rani', verified: '0' }
		});
	});

	it('sends the reason and an idempotency key with a project control', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(fixture('project-stop').body);
		await controlAdminProject('p-1', 'stop', { reason: 'Abuse', idempotencyKey: 'k-1' });
		expect(apiRequest).toHaveBeenCalledWith('api/v1/admin/projects/p-1/stop', {
			method: 'POST',
			json: { reason: 'Abuse' },
			headers: { 'Idempotency-Key': 'k-1' }
		});
	});

	it('sends the desired state and actions with a reconcile', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(fixture('project-reconcile').body);
		await controlAdminProject('p-1', 'reconcile', {
			reason: 'Route hilang',
			idempotencyKey: 'k-2',
			reconcile: { desired_state: 'running', actions: ['restore_route'] }
		});
		expect(vi.mocked(apiRequest).mock.calls[0][1]).toMatchObject({
			json: { reason: 'Route hilang', desired_state: 'running', actions: ['restore_route'] }
		});
	});

	it('sends the reason in the body of a delete', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(undefined);
		await deleteLimitProfile('lp-1', { reason: 'Tidak dipakai' });
		expect(apiRequest).toHaveBeenCalledWith('api/v1/admin/limit-profiles/lp-1', {
			method: 'DELETE',
			json: { reason: 'Tidak dipakai' }
		});
	});

	it('reads logs newest first, 200 lines a page', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(fixture('deployment-logs').body);
		await getAdminDeploymentLogs('d-1');
		expect(apiRequest).toHaveBeenCalledWith('api/v1/admin/deployments/d-1/logs', {
			params: { order: 'desc', per_page: 200, cursor: undefined }
		});
	});
});
