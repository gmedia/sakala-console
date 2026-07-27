export type User = {
	id: number;
	name: string;
	email: string;
	avatar_url?: string | null;
	role: string;
	onboarding_source?: string | null;
	onboarding_completed_at?: string | null;
	last_login_at?: string | null;
};

export type UserResource = {
	data: User;
};
