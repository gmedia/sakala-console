import type { DeploymentStatus } from '$lib/features/deployments/type';

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

export interface Project {
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
	default_domain: string;
	status: ProjectStatus;
	runtime_status: RuntimeStatus;
	detected_port: number | null;
	last_deployed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface EnvironmentVariable {
	id: string;
	key: string;
	is_secret: boolean;
	created_at: string;
}

export interface CreateEnvVarPayload {
	key: string;
	value: string;
	is_secret: boolean;
}

export interface EnvVarValueResponse {
	data: {
		value: string;
	};
}

export interface ProjectEnvironmentVariable extends EnvironmentVariable {
	project_id?: string;
	value?: string;
}

export interface Deployment {
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

export interface TriggerRedeployPayload {
	branch: string;
	idempotencyKey?: string;
}

export interface UpdateProjectPayload {
	name?: string;
	thumbnail_url?: string | null;
	branch?: string;
}

export interface Repository {
	id: string;
	name: string;
	full_name: string;
	clone_url: string;
	default_branch: string;
	pushed_at: string;
	private: boolean;
}

export interface CreateProjectPayload {
	project_name: string;
	repository_url: string;
	branch: string;
}

export interface CreateProjectResult {
	id: string;
	project_name: string;
	domain: string;
}
