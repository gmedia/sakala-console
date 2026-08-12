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

export type Repository = {
	id: string;
	name: string;
	full_name: string;
	clone_url: string;
	default_branch: string;
	pushed_at: string | null;
	private: boolean;
};
