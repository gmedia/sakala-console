import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ButtonTestHost from './ButtonTestHost.svelte';

describe('Button', () => {
	it('renders an accessible link variant', async () => {
		render(ButtonTestHost);

		await expect
			.element(page.getByRole('link', { name: 'Buka projects' }))
			.toHaveAttribute('href', '/projects');
	});
});
