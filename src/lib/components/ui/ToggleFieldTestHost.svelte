<script lang="ts">
	import ToggleField from './ToggleField.svelte';

	const onToggle = () => {};
</script>

<ToggleField title="Notifikasi" description="Notifikasi proyek" checked={true} {onToggle} />
<ToggleField title="Notifikasi" description="Notifikasi tim" checked={false} {onToggle} />
