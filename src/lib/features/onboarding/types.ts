export type OnboardingSource =
	| 'campus'
	| 'friend'
	| 'community'
	| 'workshop'
	| 'social_media'
	| 'gmedia'
	| 'github'
	| 'other';

export type DeveloperRole = 'developer' | 'devops' | 'architect';

export type MainInterest =
	| 'automation'
	| 'microservices'
	| 'cloud_native'
	| 'edge_computing'
	| 'security';

export type OnboardingData = {
	source?: OnboardingSource;
	displayName?: string;
	role?: DeveloperRole;
	interests?: MainInterest[];
};
