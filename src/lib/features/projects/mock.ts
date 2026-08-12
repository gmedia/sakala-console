import type { Project } from '$lib/features/projects/type';
import type { Repository } from '$lib/features/projects/type';

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
	},
	{
		id: '45e6f7a8-b9c0-1d2e-3f4a-5b6c7d8e9f0a',
		project_name: 'IoT Sensor Collector',
		repository_full_name: 'Gmedia/iot-collector',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-06-15T08:12:00Z'
	},
	{
		id: '56f7a8b9-c0d1-2e3f-4a5b-6c7d8e9f0a1b',
		project_name: 'Internal Knowledge Base',
		repository_full_name: 'Gmedia/internal-wiki',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: '2026-03-22T11:45:00Z'
	},
	{
		id: '67a8b9c0-d1e2-3f4a-5b6c-7d8e9f0a1b2c',
		project_name: 'Audit Trail Microservice',
		repository_full_name: 'Gmedia/audit-service',
		runtime_status: 'deploying',
		thumbnail_url: null,
		created_at: '2026-08-01T14:10:00Z'
	},
	{
		id: '78b9c0d1-e2f3-4a5b-6c7d-8e9f0a1b2c3d',
		project_name: 'HR & Payroll Portal',
		repository_full_name: 'Gmedia/hr-payroll',
		runtime_status: 'stopped',
		thumbnail_url: null,
		created_at: '2026-02-14T09:20:00Z'
	},
	{
		id: '89c0d1e2-f3a4-5b6c-7d8e-9f0a1b2c3d4e',
		project_name: 'SEO Optimization Worker',
		repository_full_name: 'Gmedia/seo-worker',
		runtime_status: 'failed',
		thumbnail_url: null,
		created_at: '2026-07-18T16:05:00Z'
	},
	{
		id: '90d1e2f3-a4b5-6c7d-8e9f-0a1b2c3d4e5f',
		project_name: 'Identity & SSO Provider',
		repository_full_name: 'Gmedia/sso-identity',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-01-10T10:00:00Z'
	},
	{
		id: '01e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
		project_name: 'Realtime Stream Processor',
		repository_full_name: 'Gmedia/stream-processor',
		runtime_status: 'crashed',
		thumbnail_url: null,
		created_at: '2026-07-29T21:15:30Z'
	},
	{
		id: '12f3a4b5-c6d7-8e9f-0a1b-2c3d4e5f6a7b',
		project_name: 'Helpdesk Ticketing UI',
		repository_full_name: 'Gmedia/helpdesk-ui',
		runtime_status: 'running',
		thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
		created_at: '2026-05-12T13:40:00Z'
	},
	{
		id: '23a4b5c6-d7e8-9f0a-1b2c-3d4e5f6a7b8c',
		project_name: 'S3 File Manager Service',
		repository_full_name: 'Gmedia/storage-service',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: '2026-04-05T06:50:00Z'
	},
	{
		id: '34b5c6d7-e8f9-0a1b-2c3d-4e5f6a7b8c9d',
		project_name: 'Webhook Event Dispatcher',
		repository_full_name: 'Gmedia/webhook-engine',
		runtime_status: 'deploying',
		thumbnail_url: null,
		created_at: '2026-08-05T17:30:10Z'
	}
];

export const mockRepositories: Repository[] = [
	{
		id: 'c28a2a5d-4f10-4f51-a9f4-12f5a6b7d001',
		name: 'sakala-console',
		full_name: 'sakala/sakala-console',
		clone_url: 'https://github.com/sakala/sakala-console.git',
		default_branch: 'main',
		pushed_at: '2026-08-01T09:30:00Z',
		private: true
	},
	{
		id: 'f87a3e12-32b4-4e9c-859a-243e8d7a1002',
		name: 'sakala-api',
		full_name: 'sakala/sakala-api',
		clone_url: 'https://github.com/sakala/sakala-api.git',
		default_branch: 'main',
		pushed_at: '2026-07-31T14:15:00Z',
		private: true
	},
	{
		id: '1e5b8a92-7f30-4e11-bc6d-354a9b8c1003',
		name: 'personal-portfolio',
		full_name: 'winter/personal-portfolio',
		clone_url: 'https://github.com/winter/personal-portfolio.git',
		default_branch: 'master',
		pushed_at: '2026-07-30T20:45:00Z',
		private: false
	},
	{
		id: '7b9c1d2e-8a03-4f52-9d1a-465b7c8d1004',
		name: 'bookverse',
		full_name: 'winter/bookverse',
		clone_url: 'https://github.com/winter/bookverse.git',
		default_branch: 'main',
		pushed_at: '2026-07-28T08:10:00Z',
		private: false
	},
	{
		id: '3d4e5f6a-9b12-4c34-8e5f-576a8b9c1005',
		name: 'ppdb-client',
		full_name: 'winter/ppdb-client',
		clone_url: 'https://github.com/winter/ppdb-client.git',
		default_branch: 'main',
		pushed_at: '2026-07-25T11:22:00Z',
		private: true
	},
	{
		id: '9a8b7c6d-5e4f-4a3b-2c1d-0e1f2a3b4c06',
		name: 'auth-service',
		full_name: 'sakala/auth-service',
		clone_url: 'https://github.com/sakala/auth-service.git',
		default_branch: 'main',
		pushed_at: '2026-07-24T16:05:00Z',
		private: true
	},
	{
		id: '4f3e2d1c-0b9a-4f8e-7d6c-5b4a3f2e1d07',
		name: 'design-system',
		full_name: 'sakala/design-system',
		clone_url: 'https://github.com/sakala/design-system.git',
		default_branch: 'main',
		pushed_at: '2026-07-22T10:40:00Z',
		private: false
	},
	{
		id: '2b3c4d5e-6f7a-489b-9c0d-1e2f3a4b5c08',
		name: 'kost-management',
		full_name: 'winter/kost-management',
		clone_url: 'https://github.com/winter/kost-management.git',
		default_branch: 'main',
		pushed_at: '2026-07-20T18:50:00Z',
		private: true
	},
	{
		id: '8a9b0c1d-2e3f-4a5b-6c7d-8e9f0a1b2c09',
		name: 'task-tracker',
		full_name: 'winter/task-tracker',
		clone_url: 'https://github.com/winter/task-tracker.git',
		default_branch: 'main',
		pushed_at: '2026-07-19T07:15:00Z',
		private: false
	},
	{
		id: '5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e10',
		name: 'ui-components',
		full_name: 'open-source/ui-components',
		clone_url: 'https://github.com/open-source/ui-components.git',
		default_branch: 'main',
		pushed_at: '2026-07-15T13:00:00Z',
		private: false
	},
	{
		id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c11',
		name: 'notification-worker',
		full_name: 'sakala/notification-worker',
		clone_url: 'https://github.com/sakala/notification-worker.git',
		default_branch: 'main',
		pushed_at: '2026-07-12T09:00:00Z',
		private: true
	},
	{
		id: '6f5e4d3c-2b1a-0f9e-8d7c-6b5a4f3e2d12',
		name: 'recipe-finder',
		full_name: 'winter/recipe-finder',
		clone_url: 'https://github.com/winter/recipe-finder.git',
		default_branch: 'main',
		pushed_at: '2026-07-10T21:30:00Z',
		private: false
	},
	{
		id: '0e9f8a7b-6c5d-4e3f-2a1b-0c9d8e7f6a13',
		name: 'payment-gateway',
		full_name: 'dev-team/payment-gateway',
		clone_url: 'https://github.com/dev-team/payment-gateway.git',
		default_branch: 'main',
		pushed_at: '2026-07-08T15:45:00Z',
		private: true
	},
	{
		id: '3b2a1c0d-9e8f-7a6b-5c4d-3e2f1a0b9c14',
		name: 'blog-cms',
		full_name: 'winter/blog-cms',
		clone_url: 'https://github.com/winter/blog-cms.git',
		default_branch: 'main',
		pushed_at: '2026-07-05T12:10:00Z',
		private: false
	},
	{
		id: '7e6f5d4c-3b2a-1f0e-9d8c-7b6a5f4e3d15',
		name: 'infrastructure',
		full_name: 'sakala/infrastructure',
		clone_url: 'https://github.com/sakala/infrastructure.git',
		default_branch: 'main',
		pushed_at: '2026-07-01T08:20:00Z',
		private: true
	}
];

export default mockProjects;
