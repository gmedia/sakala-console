import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

type GeneratedPilotLimits = components['schemas']['PilotLimitsResource'];
type GeneratedQuotas = GeneratedPilotLimits['quotas'];
/**
 * Fields an older API does not send: containers came with workspaces, `max_replicas` with replicas,
 * the database quotas with managed databases, `max_builds_per_hour` with the build rate limit, and
 * the bucket quotas with managed buckets (sakala-api #204), and the worker and schedule quotas with
 * ADR-022 (sakala-api #208), and the Valkey quotas with ADR-023 (sakala-api #211), and the custom
 * domain quotas with ADR-024 (sakala-api #213).
 */
type OptionalQuotaKey =
	| 'max_active_containers'
	| 'current_active_containers_count'
	| 'max_replicas'
	| 'max_builds_per_hour'
	| 'max_databases'
	| 'current_databases_count'
	| 'max_database_storage_mb'
	| 'current_database_storage_bytes'
	| 'max_buckets'
	| 'current_buckets_count'
	| 'max_bucket_storage_mb'
	| 'current_bucket_storage_mb'
	| 'current_bucket_usage_bytes'
	| 'max_worker_containers'
	| 'current_worker_containers_count'
	| 'max_schedules'
	| 'current_schedules_count'
	| 'min_schedule_interval_minutes'
	| 'max_concurrent_job_runs'
	| 'max_valkeys'
	| 'current_valkeys_count'
	| 'max_valkey_memory_mb'
	| 'current_valkey_memory_mb'
	| 'max_custom_domains'
	| 'current_custom_domains_count';

/**
 * The generated document types `buckets.default_quota_mb` as the literal `0`: Scramble reads the
 * property's initial value in PilotLimitsResource instead of its `int` type. The API sends the
 * configured quota (256 MB by default), so the Console reads a number. To fix in sakala-api #204
 * (an `@var int` on the property or an explicit type in the resource).
 */
type BucketsContract = Omit<GeneratedPilotLimits['buckets'], 'default_quota_mb'> & {
	default_quota_mb: number;
};

/**
 * The part of the resource the Console reads. The workspace, container, replica, idle sleep, and
 * database availability fields stay optional because an older API does not send them.
 */
type PilotLimitsContract = Pick<
	GeneratedPilotLimits,
	'runtime_defaults' | 'timeouts' | 'deleted_project_retention_days'
> & {
	quotas: Omit<GeneratedQuotas, OptionalQuotaKey> &
		Partial<Pick<GeneratedQuotas, OptionalQuotaKey>>;
	workspace_id?: GeneratedPilotLimits['workspace_id'];
	limit_profile?: GeneratedPilotLimits['limit_profile'];
	project_idle_sleep_minutes?: GeneratedPilotLimits['project_idle_sleep_minutes'];
	databases?: GeneratedPilotLimits['databases'];
	buckets?: BucketsContract;
	runtime_maximums?: GeneratedPilotLimits['runtime_maximums'];
	workers?: GeneratedPilotLimits['workers'];
	schedules?: GeneratedPilotLimits['schedules'];
	valkeys?: GeneratedPilotLimits['valkeys'];
	custom_domains?: GeneratedPilotLimits['custom_domains'];
};

const pilotLimitsResponseSchema = z.object({
	data: z.object({
		workspace_id: z.string().optional(),
		limit_profile: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
		quotas: z.object({
			max_projects_per_user: z.number(),
			max_active_deployments_per_user: z.number(),
			max_active_deployments_per_project: z.number(),
			current_projects_count: z.number(),
			current_active_deployments_count: z.number(),
			max_active_containers: z.number().optional(),
			current_active_containers_count: z.number().optional(),
			/** Most replicas per project; `1` means replicas are off for this workspace. */
			max_replicas: z.number().optional(),
			/**
			 * Deployments that build an image the workspace may create per rolling hour, already resolved
			 * from its limit profile or the server setting. `null` means no limit.
			 */
			max_builds_per_hour: z.number().nullable().optional(),
			/** Managed databases the workspace may hold; `0` allows none. */
			max_databases: z.number().optional(),
			/** Every live database except those whose creation failed. */
			current_databases_count: z.number().optional(),
			/** Total size the workspace's databases may reach, in MB (1 MB is 1024 × 1024 bytes). */
			max_database_storage_mb: z.number().optional(),
			current_database_storage_bytes: z.number().optional(),
			/** Managed buckets the workspace may hold; `0` allows none. */
			max_buckets: z.number().optional(),
			/** Every live bucket except those whose creation failed. */
			current_buckets_count: z.number().optional(),
			/** MB the bucket quotas may reserve together; `0` refuses new buckets and increases. */
			max_bucket_storage_mb: z.number().optional(),
			/** MB the quotas reserve now (allocated, not used). */
			current_bucket_storage_mb: z.number().optional(),
			/** What the buckets hold, from the storage nodes' last reports. */
			current_bucket_usage_bytes: z.number().optional(),
			/** Worker containers the workspace may run at once; they also count as running containers. */
			max_worker_containers: z.number().optional(),
			current_worker_containers_count: z.number().optional(),
			/** Enabled schedules the workspace may hold; `0` allows none. */
			max_schedules: z.number().optional(),
			current_schedules_count: z.number().optional(),
			/** Shortest gap between two slots of one schedule, in minutes. */
			min_schedule_interval_minutes: z.number().optional(),
			max_concurrent_job_runs: z.number().optional(),
			/** Managed Valkey stores the workspace may hold; `0` allows none. */
			max_valkeys: z.number().optional(),
			/** Every live store except those whose creation failed. */
			current_valkeys_count: z.number().optional(),
			/** MB of `maxmemory` the stores may reserve together; `0` refuses new stores and growth. */
			max_valkey_memory_mb: z.number().optional(),
			/** MB the stores reserve now (their sizes, a pending growth included), not what they hold. */
			current_valkey_memory_mb: z.number().optional(),
			/** Custom domains the workspace's projects may hold together; `0` allows none. */
			max_custom_domains: z.number().optional(),
			/** Claims that count: pending, verified, failed, and disabled ones, not released ones. */
			current_custom_domains_count: z.number().optional()
		}),
		runtime_defaults: z.object({
			memory_mb: z.number(),
			cpu_millis: z.number(),
			pids_limit: z.number()
		}),
		/** The per-container caps of the workspace, which a worker's memory and CPU stay within. */
		runtime_maximums: z
			.object({ memory_mb: z.number(), cpu_millis: z.number(), pids_limit: z.number() })
			.optional(),
		timeouts: z.object({
			build_timeout_seconds: z.number(),
			start_timeout_seconds: z.number(),
			command_timeout_seconds: z.number()
		}),
		deleted_project_retention_days: z.number(),
		/** `0`: projects of this workspace never sleep. */
		project_idle_sleep_minutes: z.number().optional(),
		/**
		 * Whether this installation offers managed databases right now: a database server is connected
		 * and answers. Absent from an API before sakala-api #182, which read as available.
		 */
		databases: z.object({ available: z.boolean() }).optional(),
		/**
		 * Whether this installation offers managed buckets right now, and the quota a new one gets
		 * unless asked otherwise. Absent from an API without buckets, which the Console treats as
		 * "no bucket feature": no navigation entry and no bucket offers.
		 */
		buckets: z.object({ available: z.boolean(), default_quota_mb: z.number() }).optional(),
		/**
		 * Worker processes and schedules (ADR-022) on this installation. Off by default, and absent from
		 * an API before them: either way the Console shows neither.
		 */
		workers: z.object({ enabled: z.boolean() }).optional(),
		schedules: z
			.object({
				enabled: z.boolean(),
				default_timezone: z.string(),
				default_timeout_seconds: z.number(),
				max_timeout_seconds: z.number(),
				/** How late a slot may still start before it is recorded as missed. */
				start_deadline_minutes: z.number()
			})
			.optional(),
		/**
		 * Managed Valkey stores (ADR-023). `enabled` follows the server's `SAKALA_VALKEY_ENABLED`, off by
		 * default, and the Valkey endpoints answer 404 while it is off. `available`: a node takes new
		 * stores now. Absent from an API before them; either way the Console shows nothing of Valkey.
		 */
		valkeys: z
			.object({
				enabled: z.boolean(),
				available: z.boolean(),
				sizes_mb: z.array(z.number()),
				default_size_mb: z.number()
			})
			.optional(),
		/**
		 * Custom domains for projects (ADR-024). `enabled` follows the server's
		 * `SAKALA_CUSTOM_DOMAINS_ENABLED`, off by default, and the domain endpoints answer 404 while it
		 * is off. `target` is the name a domain points at with a CNAME, never an IP address. Absent
		 * from an API before them; either way the Console shows no custom domain.
		 */
		custom_domains: z.object({ enabled: z.boolean(), target: z.string() }).optional()
	})
}) satisfies z.ZodType<{ data: PilotLimitsContract }>;

/**
 * The limits of one workspace, as parsed. Typed from the schema, so the workspace and container
 * fields stay optional like in the contract above.
 */
export type PilotLimits = z.output<typeof pilotLimitsResponseSchema>['data'];

export function parsePilotLimitsResponse(response: unknown): PilotLimits {
	return pilotLimitsResponseSchema.parse(response).data;
}

/**
 * Without a workspace the API answers for the caller's personal workspace, so the personal one is
 * asked for without the parameter.
 */
export async function getPilotLimits(workspaceId?: string | null): Promise<PilotLimits> {
	const response = workspaceId
		? await apiRequest<unknown>('/api/v1/app/pilot-limits', {
				params: { workspace_id: workspaceId }
			})
		: await apiRequest<unknown>('/api/v1/app/pilot-limits');
	return parsePilotLimitsResponse(response);
}
