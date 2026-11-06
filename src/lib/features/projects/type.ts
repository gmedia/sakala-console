import type { components } from '$lib/api/generated/schema';
import type { DeploymentStatus } from '$lib/features/deployments/type';

type ProjectContractFields = Pick<
	components['schemas']['ProjectResource'],
	| 'active_deployment_id'
	| 'effective_port'
	| 'configured_port'
	| 'build_command'
	| 'start_command'
	| 'root_directory'
	| 'auto_deploy'
	| 'redeploy_required'
	| 'stack'
	| 'preview_status'
	| 'inspection'
	| 'inspection_error_code'
	| 'suspension'
>;

type DeploymentContractFields = Pick<
	components['schemas']['DeploymentResource'],
	'is_active' | 'cancel_requested_at' | 'queue_state' | 'failure'
>;

export type RuntimeStatus =
	| 'not_deployed'
	| 'deploying'
	| 'running'
	| 'stopped'
	| 'failed'
	| 'crashed';

export type ProjectStatus = 'draft' | 'active' | 'failed' | 'suspended';

export type runtime_status = RuntimeStatus;
export type project_status = ProjectStatus;

export { type DeploymentStatus };

export const ACTIVE_DEPLOYMENT_STATUSES: readonly DeploymentStatus[] = [
	'queued',
	'cloning',
	'analyzing',
	'building',
	'deploying',
	'routing',
	'health_checking'
] as const;

export interface ProjectBase {
	id: string;
	project_name: string;
	name?: string;
	slug: string;
	repository_provider: string;
	thumbnail_url: string | null;
	repository_url: string;
	repository_full_name: string | null;
	repository_source: 'public_url' | 'github_installation';
	github_installation_id: string | null;
	github_repository_id: number | null;
	branch: string;
	default_domain: string | null;
	status: ProjectStatus;
	runtime_status: RuntimeStatus;
	detected_port: number | null;
	/** Added by the API alongside this code, so it can still be missing. */
	serving_port?: number | null;
	/** Only the single-project resource has it; the list does not send it. */
	public_url?: string | null;
	last_deployed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface Project extends ProjectBase, ProjectContractFields {}

export type EnvironmentVariable = components['schemas']['EnvironmentVariableResource'];

export interface CreateEnvVarPayload {
	key: string;
	value: string;
	is_secret: boolean;
}

export type UpdateEnvVarPayload = components['schemas']['UpdateEnvironmentVariableRequest'];

export interface EnvVarValueResponse {
	data: {
		value: string;
	};
}

export interface DeploymentBase {
	id: string;
	project_id: string;
	sequence: number;
	branch: string;
	status: DeploymentStatus;
	trigger: 'manual' | 'github_webhook';
	commit_sha: string | null;
	commit_message: string | null;
	image_reference: string | null;
	requested_resources: Record<string, unknown> | null;
	effective_resources: Record<string, unknown> | null;
	started_at: string | null;
	finished_at: string | null;
	cancelled_at: string | null;
	failure_code: string | null;
	failure_summary: string | null;
	created_at: string;
	updated_at: string;
}

export interface Deployment extends DeploymentBase, DeploymentContractFields {}

export type DeploymentFilter = '7_days' | '30_days' | 'all';

export interface GetDeploymentsParams {
	page?: number;
	per_page?: number;
	search?: string;
	filter?: DeploymentFilter;
}

export interface PaginationMeta {
	current_page: number;
	from: number | null;
	last_page: number;
	per_page: number;
	to: number | null;
	total: number;
}

export interface PaginatedDeployments {
	data: Deployment[];
	meta: PaginationMeta;
}

export interface TriggerRedeployPayload {
	branch: string;
	idempotencyKey?: string;
}

export type UpdateProjectPayload = components['schemas']['UpdateProjectRequest'];

export interface Repository {
	id: string;
	name: string;
	full_name: string;
	clone_url: string;
	default_branch: string;
	pushed_at: string;
	private: boolean;
}
