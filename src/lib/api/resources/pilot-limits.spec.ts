import { describe, expect, it, vi } from 'vitest';
import { getPilotLimits, parsePilotLimitsResponse } from './pilot-limits';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const response = {
	data: {
		quotas: {
			max_projects_per_user: 3,
			max_active_deployments_per_user: 2,
			max_active_deployments_per_project: 1,
			current_projects_count: 1,
			current_active_deployments_count: 0
		},
		runtime_defaults: { memory_mb: 256, cpu_millis: 500, pids_limit: 128 },
		runtime_maximums: { memory_mb: 512, cpu_millis: 1000, pids_limit: 256 },
		timeouts: {
			build_timeout_seconds: 600,
			start_timeout_seconds: 120,
			command_timeout_seconds: 900
		},
		log_bounds: {
			max_line_length: 4096,
			max_batch_lines: 500,
			max_total_bytes: 10485760,
			max_request_bytes: 1048576
		}
	}
};

describe('pilot limits resource', () => {
	it('reads the quotas, the runtime defaults, and the timeouts', () => {
		const limits = parsePilotLimitsResponse(response);

		expect(limits.quotas.max_projects_per_user).toBe(3);
		expect(limits.runtime_defaults.memory_mb).toBe(256);
		expect(limits.timeouts.build_timeout_seconds).toBe(600);
	});

	it('refuses a response without quotas, instead of showing an invented limit', () => {
		expect(() => parsePilotLimitsResponse({ data: {} })).toThrow();
	});

	it('asks the pilot limits endpoint', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(response);

		await getPilotLimits();

		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/pilot-limits');
	});
});
