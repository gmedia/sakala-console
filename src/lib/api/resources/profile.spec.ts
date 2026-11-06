import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../client';
import { removeAvatar, updateProfile, uploadAvatar } from './profile';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

const user = {
	id: 1,
	name: 'Rani',
	username: 'rani',
	email: 'rani@sakala.local',
	avatar_url: null,
	role: 'user',
	onboarding_source: null,
	onboarding_role: null,
	onboarding_completed_at: null,
	last_login_at: null,
	has_password: true,
	pending_email: null,
	created_at: '2026-01-01T00:00:00+00:00'
};

beforeEach(() => {
	mockedApiRequest.mockReset();
	mockedApiRequest.mockResolvedValue({ data: user });
});

describe('profile resource', () => {
	it('saves name and username with PATCH', async () => {
		await updateProfile({ name: 'Rani W' });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/app/profile', {
			method: 'PATCH',
			json: { name: 'Rani W' }
		});
	});

	it('uploads the avatar as a POST with _method, because PHP ignores a multipart PATCH body', async () => {
		const file = new File(['x'], 'foto.png', { type: 'image/png' });

		await uploadAvatar(file);

		const [path, options] = mockedApiRequest.mock.calls[0];
		const body = options?.body as FormData;
		expect(path).toBe('api/v1/app/profile');
		expect(options?.method).toBe('POST');
		expect(body.get('_method')).toBe('PATCH');
		expect((body.get('avatar') as File).name).toBe('foto.png');
	});

	it('removes the avatar with DELETE', async () => {
		await removeAvatar();

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/app/profile/avatar', {
			method: 'DELETE'
		});
	});
});
