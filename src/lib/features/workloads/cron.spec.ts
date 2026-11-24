import { describe, expect, it } from 'vitest';
import {
	checkCronExpression,
	describeCron,
	nextCronRuns,
	normalizeCronExpression,
	shortestCronGapMinutes
} from './cron';

// The moment sakala-api's own schedule tests travel to.
const NOW = new Date('2026-11-24T10:07:30Z');
const WIB = 'Asia/Jakarta';

describe('checkCronExpression', () => {
	it('takes five standard fields and collapses spaces like the API', () => {
		expect(checkCronExpression('30  2 * * *')).toEqual({ valid: true, expression: '30 2 * * *' });
		expect(normalizeCronExpression('  */15  *   * * * ')).toBe('*/15 * * * *');
	});

	it.each([
		['', 'empty'],
		['   ', 'empty'],
		['@daily', 'macro'],
		['0 * * *', 'fields'],
		['0 0 * * * *', 'fields'],
		['61 * * * *', 'value'],
		['0 25 * * *', 'value'],
		['nonsense here a b c', 'value']
	])('refuses %j as %s', (expression, reason) => {
		expect(checkCronExpression(expression)).toEqual({ valid: false, reason });
	});
});

describe('nextCronRuns', () => {
	it('reads the expression in WIB and answers instants: 02.30 WIB is 19.30 UTC the day before', () => {
		expect(nextCronRuns('30 2 * * *', WIB, 2, NOW).map((date) => date.toISOString())).toEqual([
			'2026-11-24T19:30:00.000Z',
			'2026-11-25T19:30:00.000Z'
		]);
	});

	it('reads the same expression in UTC as UTC', () => {
		expect(nextCronRuns('30 2 * * *', 'UTC', 1, NOW)[0].toISOString()).toBe(
			'2026-11-25T02:30:00.000Z'
		);
	});

	it('combines day of month and day of week with OR, as Vixie cron and the API do', () => {
		// The 1st of the month or any Monday: from Tuesday 24 November, Monday 30 comes first.
		const [first, second] = nextCronRuns('0 9 1 * 1', WIB, 2, NOW);
		expect(first.toISOString()).toBe('2026-11-30T02:00:00.000Z');
		expect(second.toISOString()).toBe('2026-12-01T02:00:00.000Z');
	});

	it('answers nothing for an expression that never comes or does not parse', () => {
		expect(nextCronRuns('0 0 31 2 *', WIB, 3, NOW)).toEqual([]);
		expect(nextCronRuns('@daily', WIB, 3, NOW)).toEqual([]);
	});
});

describe('shortestCronGapMinutes', () => {
	it.each([
		['*/15 * * * *', 15],
		['*/5 * * * *', 5],
		['0,5 * * * *', 5],
		['17 * * * *', 60],
		['30 2 * * *', 24 * 60]
	])('measures %s as %i minutes', (expression, minutes) => {
		expect(shortestCronGapMinutes(expression, WIB, NOW)).toBe(minutes);
	});

	it('has no gap for an expression with fewer than two slots', () => {
		expect(shortestCronGapMinutes('0 0 31 2 *', WIB, NOW)).toBeNull();
	});
});

describe('describeCron', () => {
	it('says the schedule in Indonesian', () => {
		expect(describeCron('30 2 * * *')).toBe('Pada 02.30');
		expect(describeCron('*/15 * * * *')).toBe('Setiap 15 menit');
		expect(describeCron('0 3 * * 1-5')).toBe('Pada 03.00, Senin sampai Jumat');
	});

	it('says nothing for what the API would refuse', () => {
		expect(describeCron('@daily')).toBeNull();
		expect(describeCron('0 * * *')).toBeNull();
	});
});
