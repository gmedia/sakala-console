export type User = {
	id: string;
	name: string;
	email: string;
	avatar_url?: string;
	roles: string[];
	created_at: string;
};

export type UserResource = {
	data: User;
};
