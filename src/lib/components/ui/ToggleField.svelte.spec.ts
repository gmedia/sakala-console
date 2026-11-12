import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ToggleField from './ToggleField.svelte';
import ToggleFieldTestHost from './ToggleFieldTestHost.svelte';

const title = 'Notifikasi';
const description = 'Notifikasi proyek';
const toggle = () => page.getByRole('switch', { name: title });

describe('ToggleField', () => {
	it('exposes the title, description, and controlled checked state', async () => {
		const onToggle = vi.fn();
		const props = { title, description, checked: false, onToggle };
		const view = await render(ToggleField, { props });

		await expect.element(toggle()).toHaveAccessibleDescription(description);
		await expect.element(toggle()).toHaveAttribute('aria-checked', 'false');

		await view.rerender({ ...props, checked: true });
		await expect.element(toggle()).toHaveAttribute('aria-checked', 'true');
	});

	it('calls onToggle once when clicked', async () => {
		const onToggle = vi.fn();
		await render(ToggleField, { props: { title, description, checked: false, onToggle } });
		await toggle().click();
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('disables the button and does not call onToggle', async () => {
		const onToggle = vi.fn();
		await render(ToggleField, {
			props: { title, description, checked: false, disabled: true, onToggle }
		});
		await expect.element(toggle()).toBeDisabled();
		await toggle().click({ force: true });
		expect(onToggle).not.toHaveBeenCalled();
	});

	it('gives switches with the same title independent descriptions', async () => {
		await render(ToggleFieldTestHost);

		const switches = page.getByRole('switch', { name: title });
		const project = switches.nth(0);
		const team = switches.nth(1);
		await expect.element(project).toHaveAccessibleDescription('Notifikasi proyek');
		await expect.element(team).toHaveAccessibleDescription('Notifikasi tim');
		expect(project.element().getAttribute('aria-describedby')).not.toBe(
			team.element().getAttribute('aria-describedby')
		);
	});
});
