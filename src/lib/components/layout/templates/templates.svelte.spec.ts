import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
import PanelNextStepsTestHost from '$lib/components/panel/PanelNextStepsTestHost.svelte';
import { MAX_PANEL_STEPS, PANEL_COPY } from '$lib/components/panel/panel';
import FocusedPageLayout from './FocusedPageLayout.svelte';
import FormPageLayout from './FormPageLayout.svelte';
import ListPageLayout from './ListPageLayout.svelte';

const block = (text: string) => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

describe('FormPageLayout', () => {
	it('puts the panel in a named landmark, with the form first and the danger zone last', async () => {
		render(FormPageLayout, {
			children: block('Form'),
			panel: block('Panel'),
			panelLabel: 'Ringkasan proyek',
			after: block('Zona berbahaya')
		});

		const panel = page.getByRole('complementary', { name: 'Ringkasan proyek' });
		await expect.element(panel).toHaveTextContent('Panel');
		// Reading order on every width: form, panel, then what must come last.
		const text = page.getByTestId('form-page').element().textContent ?? '';
		expect(text.indexOf('Form')).toBeLessThan(text.indexOf('Panel'));
		expect(text.indexOf('Panel')).toBeLessThan(text.indexOf('Zona berbahaya'));
	});

	it('renders only the form when a page has no panel yet', async () => {
		render(FormPageLayout, { children: block('Form') });

		await expect.element(page.getByTestId('form-page-main')).toHaveTextContent('Form');
		await expect.element(page.getByRole('complementary')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('form-page-after')).not.toBeInTheDocument();
	});
});

describe('ListPageLayout', () => {
	it('shows the toolbar and controls only when given', async () => {
		render(ListPageLayout, { children: block('Daftar'), toolbar: block('Kuota') });

		await expect.element(page.getByTestId('list-page-toolbar')).toHaveTextContent('Kuota');
		await expect.element(page.getByTestId('list-page-controls')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('list-page')).toHaveTextContent('Kuota Daftar');
	});
});

describe('FocusedPageLayout', () => {
	it('centers one column', async () => {
		render(FocusedPageLayout, { children: block('Satu tugas') });

		const column = page.getByTestId('focused-page');
		await expect.element(column).toHaveTextContent('Satu tugas');
		await expect.element(column).toHaveClass(/mx-auto/);
	});
});

describe('PanelNextSteps', () => {
	const step = (id: string) => ({ id, label: `Langkah ${id}`, href: `#${id}` });

	it(`links at most ${MAX_PANEL_STEPS} steps under one title`, async () => {
		render(PanelNextSteps, { steps: ['a', 'b', 'c', 'd'].map(step) });

		await expect.element(page.getByRole('heading', { name: PANEL_COPY.next })).toBeInTheDocument();
		expect(page.getByRole('link').all()).toHaveLength(MAX_PANEL_STEPS);
		await expect
			.element(page.getByRole('link', { name: 'Langkah a' }))
			.toHaveAttribute('href', '#a');
	});

	it('is absent without steps', async () => {
		render(PanelNextSteps, { steps: [] });

		await expect
			.element(page.getByRole('heading', { name: PANEL_COPY.next }))
			.not.toBeInTheDocument();
	});

	it('offers no way to hide steps unless the page keeps the choice', async () => {
		render(PanelNextSteps, { steps: ['a'].map(step) });

		await expect.element(page.getByRole('link', { name: 'Langkah a' })).toBeVisible();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});

	it('hides a step with its own button, moving focus to the next one', async () => {
		render(PanelNextStepsTestHost, { steps: ['a', 'b', 'c'].map(step) });

		await page.getByRole('button', { name: PANEL_COPY.dismissStep('Langkah a') }).click();
		await expect.element(page.getByRole('link', { name: 'Langkah a' })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: PANEL_COPY.dismissStep('Langkah b') }))
			.toHaveFocus();
		await expect.element(page.getByRole('button', { name: PANEL_COPY.restoreSteps })).toBeVisible();

		// The last one in the list hands focus to the one before it.
		await page.getByRole('button', { name: PANEL_COPY.dismissStep('Langkah c') }).click();
		await expect
			.element(page.getByRole('button', { name: PANEL_COPY.dismissStep('Langkah b') }))
			.toHaveFocus();
	});

	it('shows hidden steps again from the restore link, then focuses the list', async () => {
		render(PanelNextStepsTestHost, { steps: ['a', 'b'].map(step) });
		await expect
			.element(page.getByRole('button', { name: PANEL_COPY.restoreSteps }))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: PANEL_COPY.dismissStep('Langkah a') }).click();
		await page.getByRole('button', { name: PANEL_COPY.restoreSteps }).click();

		await expect.element(page.getByRole('link', { name: 'Langkah a' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: PANEL_COPY.next })).toHaveFocus();
		await expect
			.element(page.getByRole('button', { name: PANEL_COPY.restoreSteps }))
			.not.toBeInTheDocument();
	});
});
