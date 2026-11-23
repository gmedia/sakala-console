import { getDeployments } from '../api';
import type { Deployment, DeploymentFilter } from '../type';
import type { MetricsRangeOption } from './ranges';

/** One successful deployment on the charts: a vertical line at the moment it finished. */
export type DeploymentMarker = {
	/** `finished_at`, in Unix seconds, like the chart's time axis. */
	t: number;
	deploymentId: string;
	sequence: number;
	/** The first line of the commit message, or `null` for a deployment without one. */
	title: string | null;
};

const SUCCEEDED_STATUS = 'succeeded';

/** `IndexDeploymentRequest` allows at most 6 per page. */
export const MARKER_PAGE_SIZE = 6;

/**
 * The list has no time parameter, only `filter` on `created_at` and pages of 6 newest first, so the
 * markers walk back page by page until a page reaches the start of the window. Five pages, 30
 * deployments, keep a busy project's 30 days from spending the page's request budget
 * (`throttle:api`, 60 a minute); past that the page says only the newest are marked.
 */
export const MARKER_MAX_PAGES = 5;

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * The API's own filter, by `created_at`, as a first cut. A week covers every range up to 7 days with
 * room for a deployment created just before the window and finished in it; 30 days takes the rest.
 */
export function markerFilterFor(range: MetricsRangeOption): DeploymentFilter {
	return range.seconds < WEEK_SECONDS ? '7_days' : '30_days';
}

export type DeploymentsSinceRead = {
	deployments: Deployment[];
	/** `false` when the walk stopped at `MARKER_MAX_PAGES` before reaching the window's start. */
	complete: boolean;
};

const secondsOf = (iso: string | null): number | null => {
	if (!iso) return null;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? null : ms / 1_000;
};

/** The deployments created since `sinceSeconds`, newest first, plus the page that crosses it. */
export async function getDeploymentsSince(
	projectId: string,
	sinceSeconds: number,
	filter: DeploymentFilter
): Promise<DeploymentsSinceRead> {
	const deployments: Deployment[] = [];
	for (let page = 1; page <= MARKER_MAX_PAGES; page++) {
		const response = await getDeployments(projectId, { page, per_page: MARKER_PAGE_SIZE, filter });
		deployments.push(...response.data);
		const oldest = secondsOf(response.data.at(-1)?.created_at ?? null);
		const reachedStart = response.data.length === 0 || (oldest !== null && oldest < sinceSeconds);
		if (reachedStart || page >= response.meta.last_page) return { deployments, complete: true };
	}
	return { deployments, complete: false };
}

/** The first non-empty line, which is what a commit's subject is. */
export function commitTitle(message: string | null): string | null {
	const line = message
		?.split('\n')
		.map((part) => part.trim())
		.find((part) => part !== '');
	return line ?? null;
}

/** Successful deployments that finished inside `[start, end]`, oldest first. */
export function deploymentMarkers(
	deployments: readonly Deployment[],
	[start, end]: readonly [number, number]
): DeploymentMarker[] {
	return deployments
		.flatMap((deployment): DeploymentMarker[] => {
			if (deployment.status !== SUCCEEDED_STATUS) return [];
			const t = secondsOf(deployment.finished_at);
			if (t === null || t < start || t > end) return [];
			return [
				{
					t,
					deploymentId: deployment.id,
					sequence: deployment.sequence,
					title: commitTitle(deployment.commit_message)
				}
			];
		})
		.sort((a, b) => a.t - b.t);
}
