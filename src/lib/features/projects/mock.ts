import type { Project } from '$lib/features/projects/type';

export const mockProjects: Project[] = [
	{
		id: 1,
		project_name: 'E-Commerce Platform',
		repository_name: 'ecommerce-backend',
		status: 'success',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		status_message: null,
		created_at: '2026-03-08'
	},
	{
		id: 2,
		project_name: 'Customer Portal',
		repository_name: 'customer-portal-frontend',
		status: 'failed',
		thumbnail_url: 'https://picsum.photos/600/400',
		status_message: 'Dependency conflict: react@18.2.0 not compatible',
		created_at: '2026-07-23'
	},
	{
		id: 3,
		project_name: 'Analytics Dashboard',
		repository_name: 'analytics-service',
		status: 'pending',
		thumbnail_url: 'https://picsum.photos/600/400',
		status_message: 'Waiting for CI pipeline to start...',
		created_at: '2026-06-24'
	},
	{
		id: 4,
		project_name: 'Mobile App',
		repository_name: 'mobile-app-ios',
		status: 'pending',
		thumbnail_url: 'https://picsum.photos/600/400',
		status_message: 'Waiting for build artifacts from the CI pipeline',
		created_at: '2026-04-15'
	},
	{
		id: 5,
		project_name: 'Admin Panel',
		repository_name: 'admin-dashboard',
		status: 'failed',
		thumbnail_url: 'https://picsum.photos/600/400',
		status_message: 'Build timeout after 10 minutes',
		created_at: '2026-06-03'
	},
	{
		id: 6,
		project_name: 'Notification Service',
		repository_name: 'notification-microservice',
		status: 'success',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		status_message: null,
		created_at: '2026-05-30'
	},
	{
		id: 7,
		project_name: 'Notification Service',
		repository_name: 'notification-microservice',
		status: 'success',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		status_message: null,
		created_at: '2026-05-30'
	},
	{
		id: 8,
		project_name: 'Notification Service',
		repository_name: 'notification-microservice',
		status: 'success',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		status_message: null,
		created_at: '2026-05-30'
	}
];

export default mockProjects;
