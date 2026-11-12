import { describe, expect, it } from 'vitest';
import {
	agentName,
	agentStatus,
	bucketGrowth,
	failureCategoryLabel,
	formatRange,
	formatShare,
	formatWibDateTime,
	onboardingSourceLabel,
	shortId,
	trend
} from './format';

describe('trend', () => {
	it('gives the change in percent against the previous window', () => {
		expect(trend(118, 100)).toEqual({ direction: 'up', text: '+18%', good: true });
		expect(trend(50, 100)).toEqual({ direction: 'down', text: '−50%', good: false });
	});

	it('marks more failures as bad news', () => {
		expect(trend(12, 10, false).good).toBe(false);
		expect(trend(8, 10, false).good).toBe(true);
	});

	it('says "dari 0" instead of an infinite percentage, and "tetap" for no change', () => {
		expect(trend(3, 0).text).toBe('dari 0');
		expect(trend(4, 4)).toEqual({ direction: 'flat', text: 'tetap', good: null });
	});
});

describe('formatShare', () => {
	it('rounds to whole percent and refuses to divide by zero', () => {
		expect(formatShare(1, 3)).toBe('33%');
		expect(formatShare(0, 0)).toBeNull();
	});
});

describe('dates in WIB', () => {
	it('shows an API range as its WIB days, with the exclusive end turned into the last day', () => {
		expect(
			formatRange({ from: '2026-11-04T17:00:00+00:00', to: '2026-11-11T17:00:00+00:00' })
		).toBe('5 Nov 2026 – 11 Nov 2026');
		expect(formatRange({ from: null, to: '2026-11-11T17:00:00+00:00' })).toBe('Sampai 11 Nov 2026');
	});

	it('names the time zone, whatever the browser runs in', () => {
		expect(formatWibDateTime('2026-11-11T10:00:00+00:00')).toBe('11 Nov 2026, 17.00 WIB');
		expect(formatWibDateTime(null)).toBe('-');
	});
});

describe('bucketGrowth', () => {
	const days = (count: number) =>
		Array.from({ length: count }, (_, index) => ({
			date: new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
			count: 1
		}));

	it('keeps one column per day up to a month', () => {
		const result = bucketGrowth(days(30));
		expect(result.unit).toBe('hari');
		expect(result.buckets).toHaveLength(30);
	});

	it('groups 90 days into weeks, and the total stays the same', () => {
		const result = bucketGrowth(days(90));
		expect(result.unit).toBe('minggu');
		expect(result.buckets).toHaveLength(13);
		expect(result.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(90);
		expect(result.buckets.at(-1)).toMatchObject({
			start: '2026-10-24',
			end: '2026-10-29',
			count: 6
		});
	});
});

describe('labels', () => {
	it('names API values in Indonesian and shows unknown values as they are', () => {
		expect(failureCategoryLabel('health')).toBe('Health check');
		expect(failureCategoryLabel('quantum')).toBe('quantum');
		expect(agentStatus('offline')).toEqual({ label: 'Offline', tone: 'error' });
		expect(agentStatus('rebooting').label).toBe('rebooting');
		expect(onboardingSourceLabel(null)).toBe('Belum menjawab');
		expect(onboardingSourceLabel('campus')).toBe('Kampus');
	});

	it('names a node without a name by its agent ID', () => {
		expect(agentName({ name: 'agent-sby-01', agent_id: 'agent-01' })).toBe('agent-sby-01');
		expect(agentName({ name: null, agent_id: 'agent-01a1cae3-b6e8-701a-9eb2-70683acae471' })).toBe(
			'agent-01…3acae471'
		);
	});

	it('shortens a long ID from both ends', () => {
		expect(shortId('agent-01a1cae3-b6e8-701a-9eb2-70683acae471')).toBe('agent-01…3acae471');
		expect(shortId('short')).toBe('short');
	});
});
