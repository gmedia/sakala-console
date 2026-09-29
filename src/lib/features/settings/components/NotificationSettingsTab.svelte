<script lang="ts">
	import { ShieldCheck, Bell, Info } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import NotificationSectionCard from './NotificationSectionCard.svelte';
	import NotificationToggleItem from './NotificationToggleItem.svelte';

	interface NotificationSettings {
		enableAll: boolean;
		passwordChangeAlert: boolean;
		newLoginAlert: boolean;
		failedLoginAlert: boolean;
		deploySuccessAlert: boolean;
		deployPendingAlert: boolean;
		deployFailedAlert: boolean;
		featureUpdates: boolean;
		specialOffers: boolean;
		soundAlert: boolean;
	}

	const defaultValues: NotificationSettings = {
		enableAll: true,
		passwordChangeAlert: true,
		newLoginAlert: true,
		failedLoginAlert: true,
		deploySuccessAlert: true,
		deployPendingAlert: true,
		deployFailedAlert: true,
		featureUpdates: false,
		specialOffers: false,
		soundAlert: false
	};

	let savedBaseline = $state<NotificationSettings>({ ...defaultValues });
	let enableAll = $state(defaultValues.enableAll);
	let passwordChangeAlert = $state(defaultValues.passwordChangeAlert);
	let newLoginAlert = $state(defaultValues.newLoginAlert);
	let failedLoginAlert = $state(defaultValues.failedLoginAlert);
	let deploySuccessAlert = $state(defaultValues.deploySuccessAlert);
	let deployPendingAlert = $state(defaultValues.deployPendingAlert);
	let deployFailedAlert = $state(defaultValues.deployFailedAlert);
	let featureUpdates = $state(defaultValues.featureUpdates);
	let specialOffers = $state(defaultValues.specialOffers);
	let soundAlert = $state(defaultValues.soundAlert);

	let isDirty = $derived(
		enableAll !== savedBaseline.enableAll ||
			passwordChangeAlert !== savedBaseline.passwordChangeAlert ||
			newLoginAlert !== savedBaseline.newLoginAlert ||
			failedLoginAlert !== savedBaseline.failedLoginAlert ||
			deploySuccessAlert !== savedBaseline.deploySuccessAlert ||
			deployPendingAlert !== savedBaseline.deployPendingAlert ||
			deployFailedAlert !== savedBaseline.deployFailedAlert ||
			featureUpdates !== savedBaseline.featureUpdates ||
			specialOffers !== savedBaseline.specialOffers ||
			soundAlert !== savedBaseline.soundAlert
	);

	function toggleMaster() {
		const nextState = !enableAll;
		enableAll = nextState;
		passwordChangeAlert = nextState;
		newLoginAlert = nextState;
		failedLoginAlert = nextState;
		deploySuccessAlert = nextState;
		deployPendingAlert = nextState;
		deployFailedAlert = nextState;
		featureUpdates = nextState;
		specialOffers = nextState;
		soundAlert = nextState;
	}

	function handleSave() {
		if (!isDirty) return;
		savedBaseline = {
			enableAll,
			passwordChangeAlert,
			newLoginAlert,
			failedLoginAlert,
			deploySuccessAlert,
			deployPendingAlert,
			deployFailedAlert,
			featureUpdates,
			specialOffers,
			soundAlert
		};
	}
</script>

<div class="space-y-6">
	<div
		class="flex items-center justify-between rounded-2xl border border-border/70 bg-white p-6 shadow-xs"
	>
		<div>
			<h3 class="font-sans text-base font-semibold text-foreground">Aktifkan Semua Notifikasi</h3>
			<p class="mt-0.5 font-sans text-xs text-muted">Terima pemberitahuan untuk semua notifikasi</p>
		</div>

		<button
			type="button"
			role="switch"
			aria-label="Aktifkan Semua Notifikasi"
			aria-checked={enableAll}
			onclick={toggleMaster}
			class={cn(
				'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2',
				enableAll ? 'bg-primary-dark' : 'bg-muted/30'
			)}
		>
			<span
				class={cn(
					'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
					enableAll ? 'translate-x-5' : 'translate-x-0'
				)}
			></span>
		</button>
	</div>

	<NotificationSectionCard title="Keamanan Akun" icon={ShieldCheck}>
		<NotificationToggleItem
			title="Perubahan Kata Sandi"
			description="Kirim email konfirmasi setiap kali kata sandi atau data sensitif akun diubah."
			checked={passwordChangeAlert}
			onToggle={() => (passwordChangeAlert = !passwordChangeAlert)}
		/>
		<NotificationToggleItem
			title="Peringatan Login Baru"
			description="Terima pemberitahuan saat ada aktivitas login dari perangkat, browser, atau lokasi IP yang tidak dikenal."
			checked={newLoginAlert}
			onToggle={() => (newLoginAlert = !newLoginAlert)}
		/>
		<NotificationToggleItem
			title="Upaya Login Gagal"
			description="Peringatan instan jika sistem mendeteksi beberapa kali percobaan login yang gagal ke akun Anda."
			checked={failedLoginAlert}
			onToggle={() => (failedLoginAlert = !failedLoginAlert)}
		/>
	</NotificationSectionCard>

	<NotificationSectionCard title="Aktivitas Sistem" icon={Bell}>
		<NotificationToggleItem
			title="Deployment Berhasil"
			description="Pemberitahuan ketika build dan deployment ke production selesai tanpa error."
			checked={deploySuccessAlert}
			onToggle={() => (deploySuccessAlert = !deploySuccessAlert)}
		/>
		<NotificationToggleItem
			title="Deployment Pending"
			description="Notifikasi jika proses build atau deployment tertahan sementara sebelum dapat dilanjutkan."
			checked={deployPendingAlert}
			onToggle={() => (deployPendingAlert = !deployPendingAlert)}
		/>
		<NotificationToggleItem
			title="Deployment Gagal"
			description="Peringatan segera jika build gagal atau deployment mengalami rollback."
			checked={deployFailedAlert}
			onToggle={() => (deployFailedAlert = !deployFailedAlert)}
		/>
	</NotificationSectionCard>

	<NotificationSectionCard title="Info, Promosi & Sistem" icon={Info}>
		<NotificationToggleItem
			title="Pembaruan Fitur Aplikasi"
			description="Dapatkan berita terbaru tentang perilisan fitur baru, perbaikan bug, atau pemeliharaan sistem."
			checked={featureUpdates}
			onToggle={() => (featureUpdates = !featureUpdates)}
		/>
		<NotificationToggleItem
			title="Penawaran Khusus"
			description="Terima informasi terkait diskon, promo layanan, atau undangan acara eksklusif."
			checked={specialOffers}
			onToggle={() => (specialOffers = !specialOffers)}
		/>
	</NotificationSectionCard>

	<NotificationSectionCard title="Pengaturan Lainnya" iconText="...">
		<NotificationToggleItem
			title="Peringatan Suara"
			description="Aktifkan bunyi untuk setiap notifikasi dalam aplikasi."
			checked={soundAlert}
			onToggle={() => (soundAlert = !soundAlert)}
		/>
	</NotificationSectionCard>

	<div class="flex justify-end pt-2">
		<button
			type="button"
			onclick={handleSave}
			disabled={!isDirty}
			class={isDirty
				? 'w-full md:w-auto min-w-48 rounded-xl bg-primary-dark px-6 py-3 font-sans text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2'
				: 'w-full md:w-auto min-w-48 rounded-xl bg-[#E5E7EB] px-6 py-3 font-sans text-sm font-semibold text-[#9CA3AF] cursor-not-allowed'}
		>
			Simpan Perubahan
		</button>
	</div>
</div>
