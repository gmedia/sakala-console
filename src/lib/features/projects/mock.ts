import type { Project } from '$lib/features/projects/type';

export const mockProjects: Project[] = [
	{
		id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
		project_name: 'E-Commerce Platform',
		repository_full_name: 'Gmedia/ecommerce-backend',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: '2026-03-08T10:15:00Z'
	},
	{
		id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
		project_name: 'Customer Portal',
		repository_full_name: 'Gmedia/customer-portal-frontend',
		runtime_status: 'deploying',
		thumbnail_url: null,
		created_at: '2026-07-25T08:30:00Z'
	},
	{
		id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
		project_name: 'Analytics Dashboard',
		repository_full_name: 'Gmedia/analytics-service',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-06-24T14:45:30Z'
	},
	{
		id: '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
		project_name: 'Mobile App API',
		repository_full_name: 'Gmedia/mobile-app-backend',
		runtime_status: 'stopped',
		thumbnail_url: null,
		created_at: '2026-04-15T09:00:12Z'
	},
	{
		id: '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
		project_name: 'Admin Panel',
		repository_full_name: 'Gmedia/admin-dashboard',
		runtime_status: 'failed',
		thumbnail_url: null,
		created_at: '2026-06-03T16:20:00Z'
	},
	{
		id: '6f7a8b9c-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
		project_name: 'Notification Service',
		repository_full_name: 'Gmedia/notification-microservice',
		runtime_status: 'crashed',
		thumbnail_url: null,
		created_at: '2026-05-30T11:05:45Z'
	},
	{
		id: '7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
		project_name: 'Payment Gateway Integration',
		repository_full_name: 'Gmedia/payment-service',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-07-01T12:00:00Z'
	},
	{
		id: '8b9c0d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e',
		project_name: 'Inventory Management',
		repository_full_name: 'Gmedia/inventory-system',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: '2026-01-12T07:45:10Z'
	},
	{
		id: '9c0d1e2f-3a4b-5c6d-7e8f-9a0b1c2d3e4f',
		project_name: 'User Authentication API',
		repository_full_name: 'Gmedia/auth-service',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-02-19T18:22:00Z'
	},
	{
		id: '0d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
		project_name: 'Search & Recommendation Engine',
		repository_full_name: 'Gmedia/recommendation-ai',
		runtime_status: 'deploying',
		thumbnail_url: null,
		created_at: '2026-07-24T22:10:05Z'
	},
	{
		id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
		project_name: 'Log Aggregator Service',
		repository_full_name: 'Gmedia/logging-infra',
		runtime_status: 'stopped',
		thumbnail_url: null,
		created_at: '2026-03-14T05:30:00Z'
	},
	{
		id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e',
		project_name: 'CRM Web Portal',
		repository_full_name: 'Gmedia/crm-frontend',
		runtime_status: 'failed',
		thumbnail_url: null,
		created_at: '2026-05-18T13:15:20Z'
	},
	{
		id: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
		project_name: 'Realtime Chat Backend',
		repository_full_name: 'Gmedia/chat-websocket',
		runtime_status: 'crashed',
		thumbnail_url: null,
		created_at: '2026-07-10T19:50:00Z'
	},
	{
		id: 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
		project_name: 'Vendor Marketplace UI',
		repository_full_name: 'Gmedia/vendor-portal',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-06-11T08:05:30Z'
	},
	{
		id: 'e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
		project_name: 'Media Processing Worker',
		repository_full_name: 'Gmedia/media-worker',
		runtime_status: 'deploying',
		thumbnail_url: null,
		created_at: '2026-07-25T10:00:00Z'
	},
	{
		id: 'f67a8b9c-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
		project_name: 'Documentation Site',
		repository_full_name: 'Gmedia/docs-site',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-02-01T15:40:00Z'
	},
	{
		id: '01a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
		project_name: 'Email Marketing Engine',
		repository_full_name: 'Gmedia/email-dispatcher',
		runtime_status: 'stopped',
		thumbnail_url: null,
		created_at: '2026-04-29T20:11:00Z'
	},
	{
		id: '12b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d',
		project_name: 'GraphQL API Gateway',
		repository_full_name: 'Gmedia/api-gateway',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-01-28T09:33:15Z'
	},
	{
		id: '23c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e',
		project_name: 'Mobile App Android',
		repository_full_name: 'Gmedia/mobile-app-android',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: '2026-05-04T17:25:00Z'
	},
	{
		id: '34d5e6f7-a8b9-0c1d-2e3f-4a5b6c7d8e9f',
		project_name: 'Billing & Invoice Generator',
		repository_full_name: 'Gmedia/billing-service',
		runtime_status: 'failed',
		thumbnail_url: null,
		created_at: '2026-07-22T12:00:40Z'
	}
];

export default mockProjects;
