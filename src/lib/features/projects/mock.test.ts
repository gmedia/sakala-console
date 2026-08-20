import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mockCreateProject } from './mock';
import type { CreateProjectPayload } from './type';

describe('mockCreateProject', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const validPayload: CreateProjectPayload = {
		project_name: 'My Project',
		repository_url: 'https://github.com/foo/bar',
		branch: 'main'
	};

	it('resolves with id and project_name for valid payload', async () => {
		const resultPromise = mockCreateProject(validPayload);
		vi.runAllTimers();

		const result = await resultPromise;

		expect(result.project_name).toBe('My Project');
		expect(typeof result.id).toBe('string');
		expect(result.id.length).toBeGreaterThan(0);
	});

	it('rejects when project_name is empty', async () => {
		const resultPromise = mockCreateProject({ ...validPayload, project_name: '' });
		vi.runAllTimers();

		await expect(resultPromise).rejects.toThrow('Project name is required.');
	});

	it('rejects when project_name is whitespace only', async () => {
		const resultPromise = mockCreateProject({ ...validPayload, project_name: '   ' });
		vi.runAllTimers();

		await expect(resultPromise).rejects.toThrow('Project name is required.');
	});

	it('rejects when repository_url is empty', async () => {
		const resultPromise = mockCreateProject({ ...validPayload, repository_url: '' });
		vi.runAllTimers();

		await expect(resultPromise).rejects.toThrow('Repository URL is required.');
	});

	it('rejects when branch is empty', async () => {
		const resultPromise = mockCreateProject({ ...validPayload, branch: '' });
		vi.runAllTimers();

		await expect(resultPromise).rejects.toThrow('Branch is required.');
	});

	it('generates a unique id on each call', async () => {
		const firstPromise = mockCreateProject(validPayload);
		vi.runAllTimers();
		const first = await firstPromise;

		const secondPromise = mockCreateProject(validPayload);
		vi.runAllTimers();
		const second = await secondPromise;

		expect(first.id).not.toBe(second.id);
	});
});
