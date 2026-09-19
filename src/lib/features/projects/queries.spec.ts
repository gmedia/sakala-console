import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getListProjects } from '$lib/api/resources/projects';
import { createListProjectsQuery } from './queries';
import type { ProjectsQueryParams } from '$lib/api/resources/projects';

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: vi.fn()
}));

vi.mock('$lib/api/resources/projects', () => ({
	getListProjects: vi.fn()
}));

type ProjectsResponse = Awaited<ReturnType<typeof getListProjects>>;
type SelectResult = { projects: ProjectsResponse['data']; meta: ProjectsResponse['meta'] };

function getConfig(params: ProjectsQueryParams) {
	createListProjectsQuery(() => params);
	const queryFactory = vi.mocked(createQuery).mock.calls[0][0];
	const config = queryFactory();

	return {
		queryKey: config.queryKey,
		queryFn: config.queryFn as () => Promise<ProjectsResponse>,
		select: config.select as (data: ProjectsResponse) => SelectResult,
		placeholderData: config.placeholderData as (prev: SelectResult) => SelectResult
	};
}

function buildProjectsResponse(): ProjectsResponse {
	return {
		data: [],
		links: {
			first: null,
			last: null,
			prev: null,
			next: null
		},
		meta: {
			current_page: 1,
			from: null,
			last_page: 1,
			links: [],
			path: null,
			per_page: 6,
			to: null,
			total: 0
		}
	};
}

describe('createListProjectsQuery', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(createQuery).mockReturnValue({} as ReturnType<typeof createQuery>);
	});

	it('membuat query dengan params yang diberikan', () => {
		const params: ProjectsQueryParams = {
			page: 1,
			per_page: 6,
			search: 'sakala',
			filter: '30_days'
		};

		const config = getConfig(params);

		expect(createQuery).toHaveBeenCalledTimes(1);
		expect(config.queryKey).toEqual(queryKeys.projects.list(params));
	});

	it('memanggil getListProjects dengan params yang diberikan', async () => {
		const params: ProjectsQueryParams = {
			page: 1,
			per_page: 6,
			filter: '30_days'
		};

		const response = buildProjectsResponse();

		vi.mocked(getListProjects).mockResolvedValueOnce(response);

		const config = getConfig(params);

		const result = await config.queryFn();

		expect(getListProjects).toHaveBeenCalledTimes(1);
		expect(getListProjects).toHaveBeenCalledWith(params);
		expect(result).toEqual(response);
	});

	it('memilih data project dan meta dari response', () => {
		const params: ProjectsQueryParams = {
			page: 1,
			per_page: 6
		};

		const config = getConfig(params);

		const response = buildProjectsResponse();

		const result = config.select(response);

		expect(result).toEqual({
			projects: response.data,
			meta: response.meta
		});
	});

	it('mengembalikan data sebelumnya sebagai placeholder', () => {
		const params: ProjectsQueryParams = {
			page: 1,
			per_page: 6
		};

		const config = getConfig(params);

		const previousData: SelectResult = {
			projects: [],
			meta: {
				current_page: 1,
				from: null,
				last_page: 1,
				links: [],
				path: null,
				per_page: 6,
				to: null,
				total: 0
			}
		};

		expect(config.placeholderData(previousData)).toBe(previousData);
	});
});
