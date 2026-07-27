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
