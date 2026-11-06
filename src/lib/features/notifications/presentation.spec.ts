import { describe, expect, it } from 'vitest';
import { formatNotificationTime, notificationHref } from './presentation';

const NOW = Date.parse('2026-10-10T12:00:00Z');

describe('formatNotificationTime', () => {
	it.each([
		['2026-10-10T11:59:40Z', 'Baru saja'],
		['2026-10-10T11:55:00Z', '5 menit yang lalu'],
		['2026-10-10T09:00:00Z', '3 jam yang lalu'],
		['2026-10-07T12:00:00Z', '3 hari yang lalu']
	])('%s reads as "%s"', (createdAt, expected) => {
		expect(formatNotificationTime(createdAt, NOW)).toBe(expected);
	});

	it('shows the date after a week', () => {
		expect(formatNotificationTime('2026-09-01T12:00:00Z', NOW)).toContain('2026');
	});

	it('shows nothing rather than a made-up time when the date is missing or broken', () => {
		expect(formatNotificationTime(null, NOW)).toBe('');
		expect(formatNotificationTime('bukan tanggal', NOW)).toBe('');
	});
});

describe('notificationHref', () => {
	it('leads to the deployment, then the project, and otherwise nowhere', () => {
		expect(notificationHref({ project_id: 'p', deployment_id: 'd' })).toBe(
			'/projects/p/deployments/d'
		);
		expect(notificationHref({ project_id: 'p', deployment_id: null })).toBe('/projects/p');
		expect(notificationHref({ project_id: null, deployment_id: null })).toBeNull();
	});
});
