<script lang="ts">
	type Props = {
		message?: string;
	};

	let { message = 'Tidak ada Notifikasi' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-10 text-center">
	<svg
		width="112"
		height="88"
		viewBox="0 0 112 88"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		class="size-20 shrink-0"
		aria-hidden="true"
	>
		<!-- Ground Shadow -->
		<ellipse cx="56" cy="80" rx="36" ry="6" fill="#F1F5F9" />

		<!-- Mailbox Stand / Post -->
		<rect x="52" y="58" width="8" height="22" rx="2" fill="#94A3B8" />

		<!-- Mailbox Body Behind -->
		<path
			d="M32 58V32C32 20.9543 40.9543 12 52 12H76C81.5228 12 86 16.4772 86 22V58H32Z"
			fill="#0D5C56"
		/>

		<!-- Mailbox Top Highlight -->
		<path
			d="M32 30C32 18.9543 40.9543 10 52 10H74C79.5228 10 84 14.4772 84 20V58H32V30Z"
			fill="#0F766E"
		/>

		<!-- Mailbox Interior/Opening (dark inner) -->
		<path
			d="M32 58V32C32 20.9543 38.268 12 46 12C53.732 12 60 20.9543 60 32V58H32Z"
			fill="#0A4641"
		/>

		<!-- Envelope Peeking Out -->
		<g transform="translate(38, 26) rotate(-8)">
			<rect
				x="0"
				y="0"
				width="26"
				height="20"
				rx="2"
				fill="#FFFFFF"
				stroke="#CBD5E1"
				stroke-width="1.5"
			/>
			<path d="M0 2L13 11L26 2" stroke="#94A3B8" stroke-width="1.5" stroke-linejoin="round" />
			<path d="M0 18L9 10" stroke="#E2E8F0" stroke-width="1" />
			<path d="M26 18L17 10" stroke="#E2E8F0" stroke-width="1" />
		</g>

		<!-- Mailbox Door / Flap (open downwards) -->
		<path d="M32 58C32 58 34 68 46 68C58 68 60 58 60 58H32Z" fill="#115E59" />
		<ellipse cx="46" cy="58" rx="14" ry="4" fill="#134E4A" />

		<!-- Flag -->
		<rect x="78" y="24" width="3" height="18" rx="1.5" fill="#EF4444" />
		<path
			d="M81 24H93C94.1046 24 95 24.8954 95 26V32C95 33.1046 94.1046 34 93 34H81V24Z"
			fill="#F87171"
		/>
	</svg>

	<p class="mt-3 font-sans text-xs font-normal text-muted">{message}</p>
</div>
