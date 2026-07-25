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
		repository_full_name: 'Gmedia/payment-service',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(2)
	},
	{
		id: 'd4b7d8cb-f98d-46bb-b8dc-4d9b95f2d3b4',
		project_name: 'Inventory Management',
		repository_full_name: 'Gmedia/inventory-system',
		runtime_status: 'not_deployed',
		thumbnail_url: null,
		created_at: daysAgo(5)
	},
	{
		id: 'f1b32d48-4a15-4d5d-9f62-7f8d6d0f7d91',
		project_name: 'Authentication API',
		repository_full_name: 'Gmedia/auth-service',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(7)
	},
	{
		id: '1c2e0b39-b0f8-4b35-8b65-2d8d5dba0b76',
		project_name: 'Marketing Website',
		repository_full_name: 'Gmedia/marketing-site',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(10)
	},
	{
		id: '9b2d0d8d-3d4e-4e9b-a5d5-2a8f63cbf901',
		project_name: 'Customer Dashboard',
		repository_full_name: 'Gmedia/customer-dashboard',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(18)
	},
	{
		id: '3dfe6a9f-72f7-4bb3-81dd-fcdd2c2a7c40',
		project_name: 'Admin Dashboard',
		repository_full_name: 'Gmedia/admin-dashboard',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(29)
	},
	{
		id: 'c0a5d6a4-9d2c-4f82-8e65-cb2d72c92fd7',
		project_name: 'Warehouse System',
		repository_full_name: 'Gmedia/warehouse-system',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(31)
	},
	{
		id: '7d0e54b3-8b66-4fa9-9b91-ff4f0cfa52b3',
		project_name: 'Legacy ERP',
		repository_full_name: 'Gmedia/legacy-erp',
		runtime_status: 'stopped',
		thumbnail_url: null,
		created_at: daysAgo(45)
	},
	{
		id: 'e2d1b7c9-ef94-469d-8c31-7cb2d1b0f82c',
		project_name: 'HR Management',
		repository_full_name: 'Gmedia/hr-service',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(60)
	},
	{
		id: '5a4d1b7e-f61c-42d9-a3e6-6c8c7d1a3d9f',
		project_name: 'Billing Service',
		repository_full_name: 'Gmedia/billing-service',
		runtime_status: 'running',
		thumbnail_url: null,
		created_at: daysAgo(120)
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
		const result = filterProjects(mockProjectsTest, { search: 'billing-service', date: 'all' });
		expect(result).toHaveLength(1);
		expect(result[0].project_name).toBe('Billing Service');
	});

	it('should filter by date when date filter is 7d', () => {
		const result = filterProjects(mockProjectsTest, { search: '', date: '7d' });
		expect(result).toHaveLength(3);
	});

	it('should filter by date when date filter is 30d', () => {
		const result = filterProjects(mockProjectsTest, { search: '', date: '30d' });
		expect(result).toHaveLength(6);
	});

	it('returns all', () => {
		expect(filterProjects(mockProjectsTest, { search: '', date: 'all' })).toEqual(10);
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
