import type { NotificationItem } from './types';

export const mockNotifications: NotificationItem[] = [
	{
		id: 'notif-1',
		message:
			'Selamat datang di Sakala Console! Hubungkan akun GitHub kamu untuk mulai deploy project pertama.',
		timestamp: '19.00',
		is_read: false,
		type: 'welcome',
		created_at: '2026-09-29T19:00:00Z'
	},
	{
		id: 'notif-2',
		message:
			'Deployment project E-Commerce Platform (commit a3f2c9d) berhasil di-deploy ke production.',
		timestamp: '18.45',
		is_read: false,
		type: 'deployment',
		created_at: '2026-09-29T18:45:00Z'
	},
	{
		id: 'notif-3',
		message:
			'Build project Admin Panel gagal pada tahap pnpm run build: error TypeScript ditemukan pada file auth.ts.',
		timestamp: '18.10',
		is_read: false,
		type: 'alert',
		created_at: '2026-09-29T18:10:00Z'
	},
	{
		id: 'notif-4',
		message: 'Repositori Gmedia/customer-portal-frontend berhasil disinkronisasi dari GitHub.',
		timestamp: '17.30',
		is_read: true,
		type: 'system',
		created_at: '2026-09-29T17:30:00Z'
	},
	{
		id: 'notif-5',
		message:
			'Penggunaan memori service Payment Gateway Integration mencapai 85% dari batas kuota yang ditentukan.',
		timestamp: '16.15',
		is_read: false,
		type: 'alert',
		created_at: '2026-09-29T16:15:00Z'
	},
	{
		id: 'notif-6',
		message:
			'Preview deployment untuk branch feature/checkout-v2 pada Customer Portal siap diakses.',
		timestamp: '15.00',
		is_read: true,
		type: 'deployment',
		created_at: '2026-09-29T15:00:00Z'
	},
	{
		id: 'notif-7',
		message:
			'Sertifikat SSL otomatis untuk custom domain api.sakala.id telah berhasil diperpanjang.',
		timestamp: '14.20',
		is_read: true,
		type: 'info',
		created_at: '2026-09-29T14:20:00Z'
	},
	{
		id: 'notif-8',
		message:
			'Akses token GitHub organisasi kamu akan kedaluwarsa dalam 3 hari. Segera perbarui koneksi akun.',
		timestamp: '12.05',
		is_read: false,
		type: 'alert',
		created_at: '2026-09-29T12:05:00Z'
	},
	{
		id: 'notif-9',
		message:
			'Pemeliharaan terjadwal klaster server Singapura akan dilakukan pada hari Sabtu pukul 01.00 WIB.',
		timestamp: '10.30',
		is_read: true,
		type: 'system',
		created_at: '2026-09-29T10:30:00Z'
	},
	{
		id: 'notif-10',
		message:
			'Environment variables pada project Notification Service berhasil diperbarui oleh tim.',
		timestamp: '09.15',
		is_read: true,
		type: 'info',
		created_at: '2026-09-29T09:15:00Z'
	},
	{
		id: 'notif-11',
		message:
			'Deployment otomatis dipicu oleh webhook git push pada branch main repositori sakala-console.',
		timestamp: 'Kemarin',
		is_read: true,
		type: 'deployment',
		created_at: '2026-09-28T21:00:00Z'
	},
	{
		id: 'notif-12',
		message:
			'Backup harian snapshot database PostgreSQL untuk Analytics Dashboard berhasil dibuat.',
		timestamp: 'Kemarin',
		is_read: true,
		type: 'system',
		created_at: '2026-09-28T19:30:00Z'
	},
	{
		id: 'notif-13',
		message:
			'Health check pada instance staging Mobile App API mendeteksi respons 502 Bad Gateway.',
		timestamp: 'Kemarin',
		is_read: true,
		type: 'alert',
		created_at: '2026-09-28T16:45:00Z'
	},
	{
		id: 'notif-14',
		message:
			'Kamu telah ditambahkan sebagai collaborator dengan hak akses Admin pada project CRM Web Portal.',
		timestamp: 'Kemarin',
		is_read: true,
		type: 'info',
		created_at: '2026-09-28T11:20:00Z'
	},
	{
		id: 'notif-15',
		message: 'Kuota compute hours dan bandwidth bulanan untuk organisasi Gmedia telah diperbarui.',
		timestamp: '2 hari lalu',
		is_read: true,
		type: 'system',
		created_at: '2026-09-27T08:00:00Z'
	},
	{
		id: 'notif-16',
		message:
			'Service Realtime Chat Backend melakukan auto-scaling menjadi 3 replika karena lonjakan trafik.',
		timestamp: '2 hari lalu',
		is_read: true,
		type: 'deployment',
		created_at: '2026-09-27T06:30:00Z'
	},
	{
		id: 'notif-17',
		message:
			'Domain kustom staging.ecommerce.id telah terverifikasi dan aktif mengarah ke project kamu.',
		timestamp: '3 hari lalu',
		is_read: true,
		type: 'info',
		created_at: '2026-09-26T14:10:00Z'
	},
	{
		id: 'notif-18',
		message:
			'Pembaruan keamanan penting tersedia untuk Node.js 20 LTS runtime. Disarankan melakukan redeploy.',
		timestamp: '4 hari lalu',
		is_read: true,
		type: 'alert',
		created_at: '2026-09-25T17:40:00Z'
	},
	{
		id: 'notif-19',
		message: 'Project demo-sandbox telah berhasil diarsipkan oleh administrator tim.',
		timestamp: '5 hari lalu',
		is_read: true,
		type: 'system',
		created_at: '2026-09-24T12:00:00Z'
	},
	{
		id: 'notif-20',
		message:
			'Jelajahi dokumentasi Sakala Console untuk mempelajari panduan konfigurasi Dockerfile dan CI/CD.',
		timestamp: '1 minggu lalu',
		is_read: true,
		type: 'welcome',
		created_at: '2026-09-22T09:00:00Z'
	}
];
