import { describe, it, expect } from 'vitest';
import { filterProjects } from './filters';
import type { Project } from './type';

const now = new Date();

const daysAgo = (days: number) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	return date.toISOString();
};

const mockProjectsTest: Project[] = [
	{
		id: '6d5d5d36-5a92-4d0f-9c2e-7d6db9e3f7a1',
		project_name: 'Payment Gateway Integration',
		slug: 'payment-gateway-integration',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/payment-service',
		repository_full_name: 'Gmedia/payment-service',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'payment-gateway-integration.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(2),
		created_at: daysAgo(2),
		updated_at: daysAgo(2)
	},
	{
		id: 'd4b7d8cb-f98d-46bb-b8dc-4d9b95f2d3b4',
		project_name: 'Inventory Management',
		slug: 'inventory-management',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/inventory-system',
		repository_full_name: 'Gmedia/inventory-system',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'inventory-management.sakala.dev',
		status: 'ready',
		runtime_status: 'not_deployed',
		detected_port: 3000,
		last_deployed_at: daysAgo(5),
		created_at: daysAgo(5),
		updated_at: daysAgo(5)
	},
	{
		id: 'f1b32d48-4a15-4d5d-9f62-7f8d6d0f7d91',
		project_name: 'Authentication API',
		slug: 'authentication-api',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/auth-service',
		repository_full_name: 'Gmedia/auth-service',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'authentication-api.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(7),
		created_at: daysAgo(7),
		updated_at: daysAgo(7)
	},
	{
		id: '1c2e0b39-b0f8-4b35-8b65-2d8d5dba0b76',
		project_name: 'Marketing Website',
		slug: 'marketing-website',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/marketing-site',
		repository_full_name: 'Gmedia/marketing-site',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'marketing-website.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(10),
		created_at: daysAgo(10),
		updated_at: daysAgo(10)
	},
	{
		id: '9b2d0d8d-3d4e-4e9b-a5d5-2a8f63cbf901',
		project_name: 'Customer Dashboard',
		slug: 'customer-dashboard',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/customer-dashboard',
		repository_full_name: 'Gmedia/customer-dashboard',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'customer-dashboard.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(18),
		created_at: daysAgo(18),
		updated_at: daysAgo(18)
	},
	{
		id: '3dfe6a9f-72f7-4bb3-81dd-fcdd2c2a7c40',
		project_name: 'Admin Dashboard',
		slug: 'admin-dashboard',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/admin-dashboard',
		repository_full_name: 'Gmedia/admin-dashboard',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'admin-dashboard.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(29),
		created_at: daysAgo(29),
		updated_at: daysAgo(29)
	},
	{
		id: 'c0a5d6a4-9d2c-4f82-8e65-cb2d72c92fd7',
		project_name: 'Warehouse System',
		slug: 'warehouse-system',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/warehouse-system',
		repository_full_name: 'Gmedia/warehouse-system',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'warehouse-system.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(31),
		created_at: daysAgo(31),
		updated_at: daysAgo(31)
	},
	{
		id: '7d0e54b3-8b66-4fa9-9b91-ff4f0cfa52b3',
		project_name: 'Legacy ERP',
		slug: 'legacy-erp',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/legacy-erp',
		repository_full_name: 'Gmedia/legacy-erp',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'legacy-erp.sakala.dev',
		status: 'ready',
		runtime_status: 'stopped',
		detected_port: 3000,
		last_deployed_at: daysAgo(45),
		created_at: daysAgo(45),
		updated_at: daysAgo(45)
	},
	{
		id: 'e2d1b7c9-ef94-469d-8c31-7cb2d1b0f82c',
		project_name: 'HR Management',
		slug: 'hr-management',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/hr-service',
		repository_full_name: 'Gmedia/hr-service',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'hr-management.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(60),
		created_at: daysAgo(60),
		updated_at: daysAgo(60)
	},
	{
		id: '5a4d1b7e-f61c-42d9-a3e6-6c8c7d1a3d9f',
		project_name: 'Billing Service',
		slug: 'billing-service',
		repository_provider: 'github',
		thumbnail_url: null,
		repository_url: 'https://github.com/Gmedia/billing-service',
		repository_full_name: 'Gmedia/billing-service',
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		branch: 'main',
		default_domain: 'billing-service.sakala.dev',
		status: 'ready',
		runtime_status: 'running',
		detected_port: 3000,
		last_deployed_at: daysAgo(120),
		created_at: daysAgo(120),
		updated_at: daysAgo(120)
	}
];

describe('filterProjects', () => {
	it('returns all projects', () => {
		expect(filterProjects(mockProjectsTest, { search: '', date: 'all' })).toEqual(mockProjectsTest);
	});

	it('should filter by project name when search (case-insensitive)', () => {
		const result = filterProjects(mockProjectsTest, { search: 'inventory', date: 'all' });
		expect(result).toHaveLength(1);
		expect(result[0].project_name).toBe('Inventory Management');
	});

	it('filters repository name', () => {
		const result = filterProjects(mockProjectsTest, { search: 'Billing Service', date: 'all' });
		expect(result).toHaveLength(1);
		expect(result[0].project_name).toBe('Billing Service');
	});

	it('should filter by date when date filter is 7d', () => {
		const result = filterProjects(mockProjectsTest, { search: '', date: '7d' });
		expect(result).toHaveLength(2);
	});

	it('should filter by date when date filter is 30d', () => {
		const result = filterProjects(mockProjectsTest, { search: '', date: '30d' });
		expect(result).toHaveLength(6);
	});

	it('returns all', () => {
		expect(filterProjects(mockProjectsTest, { search: '', date: 'all' })).toEqual(mockProjectsTest);
	});

	it('combines search + 7d', () => {
		const result = filterProjects(mockProjectsTest, { search: 'payment', date: '7d' });
		expect(result).toHaveLength(1);
		expect(result[0].project_name).toBe('Payment Gateway Integration');
	});

	it('combines search + 7d', () => {
		const result = filterProjects(mockProjectsTest, { search: 'dashboard', date: '30d' });
		expect(result).toHaveLength(2);
		expect(result.map((p) => p.project_name)).toEqual(['Customer Dashboard', 'Admin Dashboard']);
	});

	it('returns empty array when search does not match', () => {
		const result = filterProjects(mockProjectsTest, { search: 'flutter', date: 'all' });
		expect(result).toEqual([]);
	});

	it('returns empty array when search matches but date filter excludes it', () => {
		const result = filterProjects(mockProjectsTest, { search: 'warehouse', date: '30d' });
		expect(result).toEqual([]);
	});

	it('search should ignore letter case', () => {
		const result = filterProjects(mockProjectsTest, { search: 'PAYMENT', date: 'all' });
		expect(result).toHaveLength(1);
	});
});
