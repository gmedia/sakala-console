import { describe, expect, it } from 'vitest';
import { parseServiceStatusResponse, type ServiceStatus } from './system';

describe('parseServiceStatusResponse', () => {
	it('returns a response that matches the generated OpenAPI type', () => {
		const status: ServiceStatus = parseServiceStatusResponse({
			data: {
				service: 'sakala-api',
				status: 'ok',
				api_version: 'v1'
			}
		});

		expect(status).toEqual({
			service: 'sakala-api',
			status: 'ok',
			api_version: 'v1'
		});
	});

	it('rejects a payload that violates the runtime schema', () => {
		expect(() =>
			parseServiceStatusResponse({
				data: {
					service: 'sakala-api',
					status: 'degraded'
				}
			})
		).toThrow();
	});
});
