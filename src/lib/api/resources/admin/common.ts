import { z } from 'zod';

/**
 * The admin API is newer than the generated OpenAPI file, so these schemas are the contract for it.
 * They were checked against responses the API really sent: see `tests/fixtures/admin` and
 * `admin.spec.ts`. Enum-like fields stay `string` where a new value from the API should show as
 * itself instead of breaking a whole list.
 */

/** Laravel's length-aware paginator: `meta` and `links` around `data`. */
export const pageMetaSchema = z.looseObject({
	current_page: z.number(),
	from: z.number().nullable(),
	last_page: z.number(),
	per_page: z.number(),
	to: z.number().nullable(),
	total: z.number()
});

export type PageMeta = z.infer<typeof pageMetaSchema>;

export function paginated<T extends z.ZodType>(item: T) {
	return z.object({ data: z.array(item), meta: pageMetaSchema });
}

export type Paginated<T> = { data: T[]; meta: PageMeta };

export function single<T extends z.ZodType>(item: T) {
	return z.object({ data: item });
}

/** A whole-day window in WIB. `to` is the exclusive end: midnight after the last day. */
export const timeRangeSchema = z.object({
	key: z.enum(['7d', '30d', '90d', 'custom', 'all']),
	from: z.string().nullable(),
	to: z.string(),
	timezone: z.string()
});

export type TimeRange = z.infer<typeof timeRangeSchema>;

export const namedRefSchema = z.object({ id: z.string(), name: z.string() });

export const userRefSchema = z.object({
	id: z.number(),
	name: z.string(),
	username: z.string()
});

export const projectRefSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	deleted: z.boolean()
});

/** Query values as the API reads them. Booleans go as `1` and `0`: Laravel's rule refuses `true`. */
export type QueryValue = string | number | undefined;
export type QueryParams = Record<string, QueryValue>;

/** Every admin mutation carries the admin's reason, which the API writes to the audit log. */
export type WithReason = { reason: string };
