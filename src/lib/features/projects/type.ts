export type runtime_status =
	| 'not_deployed'
	| 'deploying'
	| 'running'
	| 'stopped'
	| 'failed'
	| 'crashed';

export interface Project {
	id: string;
	project_name: string;
	repository_full_name: string;
	runtime_status: runtime_status;
	thumbnail_url: string | null;
	created_at: string;
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
}
