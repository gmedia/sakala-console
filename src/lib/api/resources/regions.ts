import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

const regionSchema = z.object({
	/** The value a project's `region` or a database's `region` takes, for example `jkt`. */
	slug: z.string()
}) satisfies z.ZodType<components['schemas']['RegionResource']>;

const regionListSchema = z.object({ data: z.array(regionSchema) });

export const parseRegionList = (response: unknown) =>
	regionListSchema.parse(response).data.map((region) => region.slug);

/**
 * Regions of runtime nodes that are allowed work, sorted. Empty while no node reports a region; a
 * database created then goes wherever the API places it.
 */
export async function listRegions(): Promise<string[]> {
	return parseRegionList(await apiRequest<unknown>('/api/v1/app/regions'));
}
