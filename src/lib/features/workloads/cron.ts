import { Cron } from 'croner';
import cronstrue from 'cronstrue';
// Registers the Indonesian strings with the cronstrue instance above.
import 'cronstrue/locales/id.js';

/*
 * Reading cron expressions the way sakala-api does (SchedulePolicy, dragonmantank/cron-expression):
 * exactly five fields, no `@daily` macros, read in the schedule's timezone, and day-of-month and
 * day-of-week combined with OR as in Vixie cron. croner computes the slots and cronstrue writes the
 * sentence; this module only adds the API's own rules on top. The API stays the authority: it
 * checks the same things again when saving.
 */

/** Fields of an expression: minute, hour, day of month, month, day of week (SchedulePolicy::CRON_FIELDS). */
export const CRON_FIELD_COUNT = 5;

/** Slots the API compares to find the shortest gap (SchedulePolicy::INTERVAL_CHECK_SLOTS). */
export const INTERVAL_CHECK_SLOTS = 1000;

const MS_PER_MINUTE = 60_000;
const CRONSTRUE_LOCALE = 'id';
const CLOCK_WITH_COLON = /\b(\d{2}):(\d{2})\b/g;

export type CronCheck =
	| { valid: true; expression: string }
	| { valid: false; reason: 'empty' | 'fields' | 'macro' | 'value' };

/** Collapses runs of spaces, as the API does before saving. */
export function normalizeCronExpression(expression: string): string {
	return expression.trim().replace(/\s+/g, ' ');
}

function cronOf(expression: string, timezone: string): Cron {
	return new Cron(expression, { timezone, paused: true, mode: '5-part', domAndDow: false });
}

/** Whether the API would accept the expression's shape. Says why not, for the message. */
export function checkCronExpression(expression: string): CronCheck {
	const normalized = normalizeCronExpression(expression);
	if (!normalized) return { valid: false, reason: 'empty' };
	if (normalized.startsWith('@')) return { valid: false, reason: 'macro' };
	if (normalized.split(' ').length !== CRON_FIELD_COUNT) return { valid: false, reason: 'fields' };
	try {
		cronOf(normalized, 'UTC');
	} catch {
		return { valid: false, reason: 'value' };
	}
	return { valid: true, expression: normalized };
}

/** The next `count` slots after `from`, as instants. Empty for an expression that never fires. */
export function nextCronRuns(
	expression: string,
	timezone: string,
	count: number,
	from: Date = new Date()
): Date[] {
	const check = checkCronExpression(expression);
	if (!check.valid) return [];
	try {
		return cronOf(check.expression, timezone).nextRuns(count, from);
	} catch {
		return [];
	}
}

/**
 * The shortest gap between two of the next slots, in minutes, as the API measures it against
 * `min_schedule_interval_minutes`. `null` when fewer than two slots come.
 */
export function shortestCronGapMinutes(
	expression: string,
	timezone: string,
	from: Date = new Date(),
	slots: number = INTERVAL_CHECK_SLOTS
): number | null {
	const runs = nextCronRuns(expression, timezone, slots, from);
	if (runs.length < 2) return null;
	let shortest = Infinity;
	for (let index = 1; index < runs.length; index += 1) {
		shortest = Math.min(shortest, runs[index].getTime() - runs[index - 1].getTime());
	}
	return Math.round(shortest / MS_PER_MINUTE);
}

/** `Pada 02.30, Senin sampai Jumat`. `null` when cronstrue cannot read it. */
export function describeCron(expression: string): string | null {
	const check = checkCronExpression(expression);
	if (!check.valid) return null;
	try {
		// cronstrue writes 02:30; Indonesian, and every other time on the page, writes 02.30.
		return cronstrue
			.toString(check.expression, {
				locale: CRONSTRUE_LOCALE,
				use24HourTimeFormat: true,
				throwExceptionOnParseError: true
			})
			.replace(CLOCK_WITH_COLON, '$1.$2');
	} catch {
		return null;
	}
}
