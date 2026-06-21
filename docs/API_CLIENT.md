# API Client

## Base URL

`PUBLIC_API_URL` menunjuk ke `sakala-api`; default lokal adalah `http://api.sakala.localhost:8000`. Application endpoint berada di `/api/v1`.

## Request Flow

Seluruh request produk menggunakan `apiRequest` dari `src/lib/api/client.ts`. Helper tersebut mengatur JSON headers, cookie credentials, CSRF, response kosong, network error, dan Laravel error representation.

Jangan memanggil raw `fetch` dari route atau component. Tambahkan wrapper domain ke `src/lib/api/resources` lalu gunakan melalui TanStack Query di feature terkait.

## Error Model

- `ApiError(401)`: session tidak tersedia; auth boundary dapat mengarah ke login.
- `ApiError(403)`: user login tetapi tidak memiliki izin.
- `ApiError(422)`: tampilkan field validation dari `errors`.
- `NetworkError`: tampilkan retry/offline state, bukan login redirect.
- `5xx`: tampilkan service error tanpa mengekspos payload internal.

## Generated Types

Nyalakan `sakala-api`, lalu jalankan:

```bash
pnpm api:types
```

Command membaca Scramble OpenAPI dari `http://127.0.0.1:8000/docs/api.json` agar local proxy dan
konfigurasi hostname tidak memengaruhi generation. File hasil generation boleh diregenerasi dan
di-commit, tetapi tidak diedit manual.

## Reference Implementation

Endpoint status menunjukkan pola kontrak yang wajib diikuti resource baru:

```ts
import { z } from 'zod';
import type { components } from '$lib/api/generated/schema';

type ServiceStatus = components['schemas']['ServiceStatusResource'];

const serviceStatusSchema = z.object({
	service: z.string(),
	status: z.literal('ok'),
	api_version: z.string()
}) satisfies z.ZodType<ServiceStatus>;
```

Generated OpenAPI type menjaga kecocokan saat development dan build. Zod tetap memeriksa response
nyata saat runtime karena generated TypeScript type tidak tersedia setelah code dikompilasi.

Alur lengkap referensi berada di:

- `src/lib/api/resources/system.ts`: HTTP boundary, generated type, dan runtime schema.
- `src/lib/features/system/queries.ts`: TanStack Query untuk server state.
- `src/lib/features/system/components/ApiStatusCard.svelte`: loading, success, dan error UI.
- `src/lib/api/resources/system.spec.ts`: contract parser test.
