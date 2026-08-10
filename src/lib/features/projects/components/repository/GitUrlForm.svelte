<script lang="ts">
	let {
		value = $bindable()
	}: {
		value: string;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<p class="font-montserrat-semibold">URL repository publik</p>
	<input
		type="text"
		bind:value
		placeholder="https : // github.com/username/nama-repo.git"
		class="w-full rounded-md border border-muted/30 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-muted/10"
	/>
	<p class="text-sm font-montserrat">
		Dipakai untuk repository publik yang belum terhubung ke akun GitHubmu. Repo harus bisa diakses
		tanpa login.
	</p>
</div>
