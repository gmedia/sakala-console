import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectAvatar from './ProjectAvatar.svelte';

const id = '01a0cd45-c5a6-7170-9f8d-8322191f231f';

describe('ProjectAvatar', () => {
	test('the header, which reads the detail resource, shows the same tile as the card', async () => {
		// The list sends no slug; the detail resource does, and both send the public URL.
		const card = await render(ProjectAvatar, {
			project: { id, name: 'Toko Online', public_url: 'https://toko-online.sakala.app' }
		});
		const cardAvatar = page.getByTestId('project-avatar');
		const cardTone = cardAvatar.element().getAttribute('data-tone');
		const cardInitials = cardAvatar.element().textContent?.trim();
		await card.unmount();

		await render(ProjectAvatar, {
			size: 'sm',
			project: {
				id,
				name: 'Toko Online',
				slug: 'toko-online',
				public_url: 'https://toko-online.sakala.app'
			}
		});
		const headerAvatar = page.getByTestId('project-avatar');
		await expect.element(headerAvatar).toHaveAttribute('data-tone', cardTone as string);
		await expect.element(headerAvatar).toHaveTextContent(cardInitials as string);
	});

	// Component tests load no stylesheet, so the box is checked by its classes.
	test('keeps a fixed square box at each size, so nothing shifts when an image arrives', async () => {
		const md = await render(ProjectAvatar, { project: { id, name: 'Toko' } });
		await expect.element(page.getByTestId('project-avatar')).toHaveClass('size-10', 'shrink-0');
		await md.unmount();

		await render(ProjectAvatar, { size: 'sm', project: { id, name: 'Toko' } });
		await expect.element(page.getByTestId('project-avatar')).toHaveClass('size-7', 'shrink-0');
	});

	test('sizes the thumbnail like the tile and keeps it out of the referrer and the tab order', async () => {
		await render(ProjectAvatar, {
			project: {
				id,
				name: 'Toko',
				thumbnail_url:
					'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'
			}
		});

		const thumbnail = page.getByTestId('project-avatar-thumbnail');
		await expect.element(thumbnail).toHaveAttribute('width', '40');
		await expect.element(thumbnail).toHaveAttribute('height', '40');
		await expect.element(thumbnail).toHaveAttribute('referrerpolicy', 'no-referrer');
		await expect.element(thumbnail).toHaveAttribute('loading', 'lazy');
		await expect.element(thumbnail).toHaveClass(/object-cover/);
		expect(thumbnail.element().getAttribute('tabindex')).toBeNull();
	});
});
