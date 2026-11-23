<script lang="ts">
	import { Popover } from 'bits-ui';
	import FastForward from 'phosphor-svelte/lib/FastForward';
	import Info from 'phosphor-svelte/lib/Info';
	import Pause from 'phosphor-svelte/lib/Pause';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import type { SkippedPush } from '../../type';
	import { HISTORY_ACTION_CELL, historyRowColumns } from '../../history-grid';
	import {
		isHeldPush,
		shortSha,
		SKIPPED_PUSH_COPY,
		skippedPushFiles,
		skippedPushTitle
	} from '../../skipped-pushes';

	let { skip, withActions = false }: { skip: SkippedPush; withActions?: boolean } = $props();

	const held = $derived(isHeldPush(skip));
	const title = $derived(skippedPushTitle(skip));
	const files = $derived(skippedPushFiles(skip));
	const question = $derived(
		held ? SKIPPED_PUSH_COPY.heldQuestion : SKIPPED_PUSH_COPY.skippedQuestion
	);
	const contentId = $derived(`skipped-push-${skip.delivery_id}`);
</script>

<!--
	Same grid as DeploymentRow, so the columns line up, but quieter: a dashed outline instead of a filled
	status dot, muted text, no link (a skipped push has no deployment page) and no number. The only
	control is the explanation.
-->
<li
	class={cn(
		'grid gap-x-2.5 gap-y-1 bg-background px-4 py-3 @3xl:items-center @3xl:gap-x-3 @3xl:py-2.5',
		historyRowColumns(withActions)
	)}
	data-testid="skipped-push-row"
	data-reason={skip.reason}
>
	<span class="inline-flex items-center gap-2 @3xl:col-start-1 @3xl:row-start-1">
		<span
			class="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-surface text-muted"
			aria-hidden="true"
		>
			{#if held}
				<Pause size={11} weight="bold" />
			{:else}
				<FastForward size={11} weight="bold" />
			{/if}
		</span>
		<span class="hidden text-sm text-muted @3xl:inline"
			>{held ? SKIPPED_PUSH_COPY.heldStatus : SKIPPED_PUSH_COPY.skippedStatus}</span
		>
	</span>

	<div class="min-w-0 @3xl:col-start-3 @3xl:row-start-1">
		<div class="flex min-w-0 items-start gap-1 @3xl:items-center">
			<!-- Wraps on a phone: the folder name at the end is the point. -->
			<p class="min-w-0 text-sm leading-6 wrap-anywhere text-muted @3xl:truncate" {title}>
				{title}
			</p>
			<Popover.Root>
				<Popover.Trigger
					class="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-tint hover:text-foreground focus-visible:outline-3 focus-visible:outline-primary"
					aria-label={question}
					aria-controls={contentId}
				>
					<Info size={16} aria-hidden="true" />
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content
						id={contentId}
						side="bottom"
						align="start"
						sideOffset={8}
						collisionPadding={16}
						role="dialog"
						aria-label={question}
						class="z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-overlay border border-border bg-surface p-4 shadow-overlay focus:outline-none"
						data-testid="skipped-push-detail"
					>
						<p class="text-sm font-semibold text-foreground">{question}</p>
						{#if held}
							<p class="text-sm text-foreground">
								{SKIPPED_PUSH_COPY.heldReason(shortSha(skip.commit_sha))}
							</p>
							<p class="text-sm text-muted">{SKIPPED_PUSH_COPY.heldNext(skip.branch)}</p>
						{:else}
							<p class="text-sm text-foreground">
								Commit <span class="font-mono">{shortSha(skip.commit_sha)}</span> hanya mengubah file
								milik proyek lain di repository ini, jadi proyek ini tidak di-deploy ulang.
							</p>
							<p class="text-sm text-muted">
								Perubahan di dalam <span class="font-mono wrap-anywhere">{skip.root_directory}</span
								> men-deploy proyek ini. Perubahan di folder proyek lain hanya men-deploy proyek itu.
								File bersama di luar folder proyek mana pun, seperti lockfile atau README di root, men-deploy
								semua proyek.
							</p>
							<p class="text-sm text-muted">
								Kalau file yang berubah tidak bisa dipastikan, misalnya pada force push, semua
								proyek tetap di-deploy.
							</p>
						{/if}
						{#if !held || files.paths.length > 0}
							<div class="flex flex-col gap-1">
								<p class="text-xs text-muted">{files.summary}</p>
								<ul
									class="flex flex-col gap-0.5 rounded-control bg-background-soft px-2 py-1 font-mono text-xs text-foreground"
								>
									{#each files.paths as path (path)}
										<li class="wrap-anywhere">{path}</li>
									{/each}
									{#if files.more}
										<li class="font-sans text-muted">{files.more}</li>
									{/if}
								</ul>
							</div>
						{/if}
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>
		{#if skip.commit_message}
			<p class="truncate text-xs text-muted" title={skip.commit_message}>{skip.commit_message}</p>
		{/if}
	</div>

	<div
		class="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted @3xl:contents"
	>
		<span class="hidden @3xl:col-start-2 @3xl:row-start-1 @3xl:inline" aria-hidden="true">-</span>
		<span class="font-mono tabular-nums @3xl:col-start-4 @3xl:row-start-1">
			{shortSha(skip.commit_sha)}
		</span>
		<span class="min-w-0 truncate font-mono @3xl:col-start-5 @3xl:row-start-1" title={skip.branch}>
			{skip.branch}
		</span>
		<time
			datetime={skip.created_at}
			title={formatDate(skip.created_at)}
			class="whitespace-nowrap @3xl:col-start-6 @3xl:row-start-1"
		>
			{formatRelativeTime(skip.created_at)}
		</time>
		<span
			class="hidden @3xl:col-start-7 @3xl:row-start-1 @3xl:inline @3xl:text-right"
			aria-hidden="true">-</span
		>
	</div>

	{#if withActions}
		<span class={HISTORY_ACTION_CELL} aria-hidden="true"></span>
	{/if}
</li>
