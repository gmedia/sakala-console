import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import DeploymentLogConsoleTestHost from './DeploymentLogConsoleTestHost.svelte';
import type { DeploymentLogLine } from '../deployment-logs';

function makeLines(count: number, start = 1): DeploymentLogLine[] {
	return Array.from({ length: count }, (_, index) => ({
		sequence: start + index,
		stream: 'stdout',
		message: `baris ${start + index}`,
		recorded_at: '2026-09-20T08:41:02.000000Z'
	}));
}

function logElement(): HTMLElement {
	return page.getByRole('log').element() as HTMLElement;
}

async function scrollTo(element: HTMLElement, top: number) {
	element.scrollTop = top;
	element.dispatchEvent(new Event('scroll'));
	await tick();
}

function isAtBottom(element: HTMLElement) {
	return element.scrollHeight - element.scrollTop - element.clientHeight <= 1;
}

describe('DeploymentLogConsole', () => {
	it('exposes a named, keyboard-reachable log region', async () => {
		await render(DeploymentLogConsoleTestHost, { initialLines: makeLines(1) });

		const log = page.getByRole('log', { name: 'Log deployment' });
		await expect.element(log).toBeVisible();

		await expect.element(log).toHaveAttribute('tabindex', '0');
	});

	it('renders a message as text, never as HTML', async () => {
		const payload = '<img src=x onerror="window.__xss=1"><b>tebal</b>';
		await render(DeploymentLogConsoleTestHost, {
			initialLines: [{ ...makeLines(1)[0], message: payload }]
		});

		await expect.element(page.getByText(payload)).toBeVisible();
		expect(logElement().querySelector('img, b')).toBeNull();
		expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
	});

	it('labels stderr and system with text, and tints stderr apart from stdout', async () => {
		await render(DeploymentLogConsoleTestHost, {
			initialLines: [
				{ ...makeLines(1)[0], stream: 'stderr', message: 'npm warn' },
				{ ...makeLines(1, 2)[0], stream: 'system', message: 'container mulai' },
				{ ...makeLines(1, 3)[0], stream: 'stdout', message: 'keluaran biasa' }
			]
		});

		await expect.element(page.getByText('stderr', { exact: true })).toBeVisible();
		await expect.element(page.getByText('system', { exact: true })).toBeVisible();
		await expect.element(page.getByText('stdout', { exact: true })).not.toBeInTheDocument();

		const stderrMessage = page.getByText('npm warn').element();
		const stdoutMessage = page.getByText('keluaran biasa').element();
		expect(getComputedStyle(stderrMessage).color).not.toBe(getComputedStyle(stdoutMessage).color);
	});

	it('wraps a long unbroken line instead of scrolling sideways', async () => {
		await render(DeploymentLogConsoleTestHost, {
			initialLines: [{ ...makeLines(1)[0], message: 'x'.repeat(4096) }]
		});

		await expect.element(page.getByRole('log')).toBeVisible();
		const log = logElement();
		expect(log.scrollWidth).toBeLessThanOrEqual(log.clientWidth);
	});

	it('follows new lines while the reader is at the bottom', async () => {
		const { component } = await render(DeploymentLogConsoleTestHost, {
			initialLines: makeLines(50)
		});
		await tick();
		const log = logElement();
		expect(isAtBottom(log)).toBe(true);

		component.setLines(makeLines(80));
		await expect.element(page.getByText('baris 80', { exact: true })).toBeInTheDocument();
		await tick();

		expect(isAtBottom(log)).toBe(true);
		await expect.element(page.getByRole('button', { name: /log terbaru/ })).not.toBeInTheDocument();
	});

	it('stops following after scrolling up, counts new lines, and jumps back', async () => {
		const onJumpToLatest = vi.fn();
		const { component } = await render(DeploymentLogConsoleTestHost, {
			initialLines: makeLines(50),
			onJumpToLatest
		});
		await tick();
		const log = logElement();

		await scrollTo(log, 0);
		await expect.element(page.getByTestId('following')).toHaveTextContent('tidak mengikuti');

		component.setLines(makeLines(53));
		const jump = page.getByRole('button', { name: '3 baris baru, ke log terbaru' });
		await expect.element(jump).toBeVisible();
		expect(log.scrollTop).toBe(0);

		await jump.click();
		await expect.element(page.getByTestId('following')).toHaveTextContent('mengikuti');
		await tick();
		expect(isAtBottom(log)).toBe(true);
		expect(onJumpToLatest).toHaveBeenCalledTimes(1);
	});

	it('resumes following when the reader scrolls back to the bottom', async () => {
		await render(DeploymentLogConsoleTestHost, { initialLines: makeLines(50) });
		await tick();
		const log = logElement();

		await scrollTo(log, 0);
		await expect.element(page.getByTestId('following')).toHaveTextContent('tidak mengikuti');

		await scrollTo(log, log.scrollHeight);
		await expect.element(page.getByTestId('following')).toHaveTextContent('mengikuti');
	});

	it('stays paused at the bottom until the reader asks to follow', async () => {
		const { component } = await render(DeploymentLogConsoleTestHost, {
			initialLines: makeLines(50),
			paused: true
		});
		await tick();
		const log = logElement();

		await scrollTo(log, log.scrollHeight);
		await expect.element(page.getByTestId('following')).toHaveTextContent('tidak mengikuti');

		const top = log.scrollTop;
		component.setLines(makeLines(60));
		await expect.element(page.getByRole('button', { name: /log terbaru/ })).toBeVisible();
		expect(log.scrollTop).toBe(top);
	});

	it('keeps the reader in place when older lines are prepended', async () => {
		const { component } = await render(DeploymentLogConsoleTestHost, {
			initialLines: makeLines(50, 51)
		});
		await tick();
		const log = logElement();
		await scrollTo(log, 200);
		const lineBefore = page
			.getByText('baris 60', { exact: true })
			.element()
			.getBoundingClientRect();

		component.setLines(makeLines(100, 1));
		await expect.element(page.getByText('baris 1', { exact: true })).toBeInTheDocument();
		await tick();

		const lineAfter = page.getByText('baris 60', { exact: true }).element().getBoundingClientRect();
		expect(Math.abs(lineAfter.top - lineBefore.top)).toBeLessThanOrEqual(1);
	});

	it('renders 2.000 lines without losing the bottom', async () => {
		const { component } = await render(DeploymentLogConsoleTestHost, {
			initialLines: makeLines(1)
		});

		component.setLines(makeLines(2000));

		await expect.element(page.getByText('baris 2000', { exact: true })).toBeInTheDocument();
		await tick();
		expect(isAtBottom(logElement())).toBe(true);
	});

	it('shows no cursor on a log that has ended', async () => {
		await render(DeploymentLogConsoleTestHost, { initialLines: makeLines(2) });

		await expect.element(page.getByTestId('log-cursor')).not.toBeInTheDocument();
	});
});
