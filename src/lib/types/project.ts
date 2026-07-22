export type ProjectStatus = 'success' | 'failed' | 'pending';

export interface Project {
	id: number;
	project_name: string;
	repository_name: string;
	status: ProjectStatus;
	thumbnail_url: string;
	status_message?: string | null;
	created_at: string;
}
