# Architecture

## Role

`sakala-console` adalah presentation layer untuk user Sakala. Console menampilkan state dari `sakala-api`, mengirim intent user melalui HTTP, dan nanti menerima update realtime dari Reverb.

```text
Browser
  -> Sakala Console (SvelteKit static SPA)
  -> Sakala API (Laravel control plane)
  -> Agent command table / events
  -> Sakala Agent (Rust runtime executor)
```

Console tidak menjalankan deployment, tidak menyimpan source of truth product, dan tidak mengakses Docker.

## Static SPA

SvelteKit memakai `adapter-static` dengan fallback `index.html`, `ssr = false`, dan `prerender = false`. Pilihan ini sesuai untuk authenticated console; SEO dan content discovery ditangani `sakala-landing`.

Hosting wajib mengarahkan unknown browser route ke `index.html` agar deep link seperti `/projects/{id}` tetap dapat dibuka.

## Layering

```text
routes       -> page composition dan route layouts
features     -> UI/query/mutation per product domain
components   -> reusable UI/layout/feedback primitives
api          -> HTTP, CSRF, errors, resources, OpenAPI types
stores       -> local UI state only
```

Component tidak boleh memanggil raw `fetch`. Resource wrapper mengelola path dan representation, sementara feature query/mutation mengelola caching dan invalidation.

Alur normal saat sebuah page membutuhkan data:

```text
route/page
  -> feature component
  -> feature query atau mutation
  -> API resource
  -> apiRequest()
  -> sakala-api
  -> parse envelope / schema
  -> TanStack Query cache
  -> component render
```

Jadi kalau ada bug response API, tempat pertama yang dicek adalah `src/lib/api/resources/*`. Kalau ada bug cache, invalidation, atau loading state, tempat pertama yang dicek adalah `src/lib/features/<domain>/queries.ts` atau `mutations.ts`. Page di `src/routes` seharusnya tidak menjadi tempat debug logic API yang kompleks.

## Routes

`src/routes` adalah tempat menyusun halaman, bukan tempat menaruh semua logic produk.

Route bertanggung jawab untuk:

- memilih layout yang tepat;
- menyusun komponen dari `features` dan `components`;
- mengatur page title atau metadata ringan;
- melakukan redirect ringan jika memang dibutuhkan oleh page.

Route tidak seharusnya:

- memanggil raw `fetch`;
- parsing response API;
- menyimpan business rule deployment;
- membuat ulang schema response;
- memuat komponen domain yang terlalu besar langsung di file page.

Console memakai route group SvelteKit:

```text
src/routes/(public)
  -> halaman publik seperti login

src/routes/(app)
  -> halaman console yang nanti membutuhkan session user
```

Nama route group tidak ikut muncul di URL. Contoh `src/routes/(app)/dashboard/+page.svelte` tetap menjadi `/dashboard`.

## Components

Folder `src/lib/components` hanya untuk komponen yang bisa dipakai lintas domain.

```text
components/ui
  -> primitive kecil seperti Button, Card, Badge

components/layout
  -> shell, sidebar, topbar, page container

components/feedback
  -> empty state, loading state, error block, alert

components/brand
  -> logo dan elemen brand Sakala
```

Rule praktisnya:

- `Button`, `Card`, `Badge` masuk `components/ui`.
- `AppShell`, sidebar, topbar masuk `components/layout`.
- `EmptyState` dan error/loading reusable masuk `components/feedback`.
- `ProjectCard`, `DeploymentTimeline`, `AgentStatusBadge` tidak masuk `components/ui`; itu masuk `features/<domain>/components`.

Alasannya sederhana: `components/ui` harus tetap generik. Kalau komponen sudah tahu istilah produk seperti project, deployment, repo, agent, atau runtime, berarti dia bukan primitive UI lagi.

## Features

`src/lib/features` adalah tempat UI dan behavior per domain produk. Ini membantu tim frontend membagi pekerjaan tanpa semua file menumpuk di `routes`.

Contoh domain yang masuk akal untuk Sakala:

```text
features/auth
features/onboarding
features/projects
features/deployments
features/agents
features/settings
features/admin
features/system
```

Struktur feature yang disarankan:

```text
features/projects/
  components/
    ProjectCard.svelte
    ProjectList.svelte
    CreateProjectForm.svelte
  queries.ts
  mutations.ts
  types.ts
```

Contoh yang sudah ada sekarang:

```text
features/system/components/ApiStatusCard.svelte
features/system/queries.ts
```

`ApiStatusCard` tidak tahu detail URL API. Dia hanya memakai query dari feature. Query tersebut memanggil resource `src/lib/api/resources/system.ts`. Ini pattern yang perlu dipakai untuk feature lain.

## API Layer

Folder `src/lib/api` adalah boundary resmi antara console dan `sakala-api`.

```text
api/client.ts
  -> HTTP client, credentials, CSRF, headers, error normalization

api/csrf.ts
  -> pembacaan XSRF token untuk request unsafe

api/envelope.ts
  -> helper untuk response envelope { data }

api/errors.ts
  -> ApiError, NetworkError, validation error helpers

api/resources/*
  -> wrapper endpoint per domain

api/query-keys.ts
  -> satu tempat untuk key TanStack Query

api/query-client.ts
  -> default cache policy TanStack Query

api/generated/schema.d.ts
  -> tipe dari OpenAPI sakala-api
```

Resource API adalah satu-satunya tempat yang boleh tahu path endpoint. Contoh:

```ts
getServiceStatus()
  -> apiRequest('/api/v1')
```

Kalau nanti ada endpoint project:

```ts
listProjects()
  -> apiRequest('/api/v1/app/projects')

createProject(payload)
  -> apiRequest('/api/v1/app/projects', { method: 'POST', json: payload })
```

Page atau component tidak boleh menulis path seperti `/api/v1/app/projects` sendiri-sendiri. Kalau path berubah, cukup ubah resource.

## Generated API Types

`src/lib/api/generated/schema.d.ts` bukan hanya dokumentasi untuk dibaca manusia. File ini adalah contract type yang akan dipakai langsung di kode.

Contoh pattern:

```ts
import type { components } from '$lib/api/generated/schema';

export type ServiceStatus = components['schemas']['ServiceStatusResource'];
```

Dengan pattern ini, frontend tidak perlu menebak-nebak response API. Backend tetap menjadi sumber kebenaran melalui OpenAPI/Scramble, lalu console mengonsumsi hasil generate-nya.

Zod tetap boleh dipakai, tapi selektif:

- untuk memastikan envelope runtime benar saat data masuk dari network;
- untuk validasi form ringan di client;
- untuk boundary yang belum punya generated type kuat.

Zod tidak dipakai untuk menduplikasi semua schema backend secara manual. Kalau semua schema ditulis dua kali, frontend dan backend akan cepat tidak sinkron.

## Server State

TanStack Query menyimpan data API seperti user, projects, deployments, dan logs. Svelte runes menyimpan state lokal seperti mobile navigation, selected tab, dan draft UI yang belum dikirim.

Satu data domain tidak boleh disalin ke global store manual karena akan menghasilkan cache kedua yang mudah stale.

Pakai TanStack Query untuk:

- current user;
- daftar project;
- detail project;
- deployment history;
- deployment logs;
- status agent;
- GitHub repositories;
- admin metrics.

Pakai Svelte state/runes/store untuk:

- sidebar terbuka atau tertutup;
- tab yang sedang aktif;
- modal terbuka atau tertutup;
- filter lokal yang belum dikirim ke API;
- draft input form sebelum submit.

Rule pendeknya:

```text
Data dari API       -> TanStack Query
State interaksi UI  -> Svelte state/runes
```

Jangan simpan `projects`, `deployments`, atau `currentUser` di global store manual kecuali ada alasan yang sangat jelas.

## API Contract

Endpoint aplikasi berada di `/api/v1`. Laravel API Resource menghasilkan envelope `{ data }`; Scramble menyediakan OpenAPI pada `/docs/api.json`. `openapi-typescript` menghasilkan contract ke `src/lib/api/generated/schema.d.ts`.

Zod dipakai selektif untuk form atau runtime boundary yang belum memiliki generated contract kuat, bukan sebagai salinan ketiga seluruh schema API.

## Authentication

Console memakai Sanctum SPA cookie/session authentication:

```text
GET /sanctum/csrf-cookie
unsafe API request + credentials + X-XSRF-TOKEN
Laravel session/policy authorization
```

Machine auth milik agent/CLI dan tidak dipakai browser console. Lihat [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

Artinya console tidak memakai token agent dan tidak perlu menyimpan JWT di `localStorage` untuk flow dashboard first-party. Browser membawa session cookie dengan `credentials: 'include'`, sedangkan `apiRequest()` memastikan request unsafe menyiapkan CSRF header.

Flow login GitHub yang dituju:

```text
User klik login GitHub di console
  -> browser diarahkan ke sakala-api
  -> sakala-api menjalankan Socialite OAuth
  -> sakala-api membuat session
  -> browser kembali ke console
  -> console fetch current user
```

Authorization tetap keputusan `sakala-api` melalui policy, middleware, dan session user. Console hanya menyesuaikan tampilan berdasarkan response yang diterima.

## Forms And Mutations

Form di console boleh memiliki validasi ringan agar user mendapat feedback cepat, tetapi validasi final tetap ada di `sakala-api`.

Alur form yang disarankan:

```text
Form component
  -> local form state
  -> client-side validation ringan jika perlu
  -> feature mutation
  -> API resource
  -> sakala-api validation
  -> tampilkan validation error dari API
  -> invalidate query yang relevan
```

Contoh create project nanti:

```text
/projects/new page
  -> CreateProjectForm
  -> createCreateProjectMutation()
  -> createProject(payload)
  -> POST /api/v1/app/projects
  -> invalidate queryKeys.projects.list()
  -> goto /projects/{id}
```

Jangan menaruh `goto`, invalidation, dan parsing error tersebar di banyak component. Untuk flow domain, simpan di mutation feature agar behavior konsisten.

## Loading, Empty, And Error States

Setiap feature yang mengambil data harus memikirkan empat state:

```text
pending
error
empty
success
```

Error penting tidak boleh hanya disembunyikan di toast. Untuk dashboard seperti Sakala, user perlu tahu apakah API tidak aktif, session habis, project kosong, atau deployment gagal.

Pola yang disarankan:

- loading kecil untuk request cepat;
- skeleton atau panel loading untuk area besar;
- `EmptyState` untuk data kosong yang normal;
- error block untuk kegagalan yang perlu tindakan user;
- toast hanya untuk feedback tambahan, bukan satu-satunya penjelasan.

## Realtime

Laravel Echo dan Pusher client belum menjadi dependency. Keduanya ditambahkan setelah API menyediakan Reverb configuration, private channel authorization, event names, dan reconnect behavior yang dapat diuji.

Realtime nanti dipakai untuk hal seperti:

- streaming deployment logs;
- status deployment berubah;
- agent heartbeat berubah;
- route/runtime health update.

Ketika realtime masuk, jangan langsung menaruh Echo setup di page. Tempatkan boundary-nya di `src/lib/realtime`, lalu integrasikan ke feature yang membutuhkan. Query cache tetap menjadi sumber render utama; event realtime sebaiknya mengupdate atau invalidate cache, bukan membuat state paralel yang susah dilacak.

## Example Flows

### API Status Card

Flow yang sudah ada sekarang:

```text
/dashboard page
  -> ApiStatusCard
  -> createServiceStatusQuery()
  -> getServiceStatus()
  -> apiRequest('/api/v1')
  -> parse { data }
  -> TanStack Query cache
  -> render status API
```

Ini contoh paling kecil dari arsitektur console: page menyusun tampilan, feature mengelola query, resource mengelola endpoint, client mengelola HTTP.

### Future Project Creation

Flow yang diharapkan saat fitur project dibuat:

```text
/projects/new page
  -> CreateProjectForm
  -> createCreateProjectMutation()
  -> createProject(payload)
  -> POST /api/v1/app/projects
  -> sakala-api creates project
  -> invalidate projects list
  -> redirect ke detail project
```

Console tidak menentukan domain final project, resource policy, deployment command, atau agent target. Itu urusan `sakala-api`.

### Future Deployment Logs

Flow awal tanpa realtime:

```text
project detail page
  -> DeploymentLogPanel
  -> deployment logs query
  -> GET /api/v1/app/deployments/{id}/logs
  -> render log history
```

Flow setelah Reverb siap:

```text
initial logs query
  -> subscribe private deployment channel
  -> receive new log event
  -> append/update TanStack Query cache
  -> component rerender
```

Realtime menambah kecepatan update, bukan mengganti API contract utama.

## Practical Placement Rules

Gunakan aturan ini saat bingung harus menaruh kode di mana:

| Kebutuhan                            | Tempat                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| Page baru                            | `src/routes/.../+page.svelte`                              |
| Layout console                       | `src/routes/(app)/+layout.svelte` atau `components/layout` |
| Tombol/card/badge generik            | `src/lib/components/ui`                                    |
| Empty/error/loading reusable         | `src/lib/components/feedback`                              |
| Komponen product seperti ProjectCard | `src/lib/features/projects/components`                     |
| Query list/detail dari API           | `src/lib/features/<domain>/queries.ts`                     |
| Create/update/delete action          | `src/lib/features/<domain>/mutations.ts`                   |
| Wrapper endpoint API                 | `src/lib/api/resources/<domain>.ts`                        |
| Raw HTTP behavior                    | `src/lib/api/client.ts`                                    |
| Query key                            | `src/lib/api/query-keys.ts`                                |
| Generated OpenAPI type               | `src/lib/api/generated/schema.d.ts`                        |
| State sidebar/modal/tab              | `src/lib/stores` atau file `.svelte.ts`                    |
| Realtime setup nanti                 | `src/lib/realtime`                                         |

## Anti-Patterns

Hindari pattern ini:

- raw `fetch` langsung di page atau component;
- endpoint path ditulis berulang di banyak file;
- parsing envelope `{ data }` di page;
- menyimpan data API besar di global store manual;
- menaruh komponen domain seperti `ProjectCard` di `components/ui`;
- membuat type response manual padahal sudah ada generated OpenAPI type;
- membuat business rule deployment di frontend;
- menganggap console sebagai backend kedua;
- menyimpan token agent atau machine token di browser;
- membuat realtime state paralel yang tidak sinkron dengan query cache.

## Boundary With Other Repositories

Pembagian tanggung jawab Sakala:

```text
sakala-console
  -> UI, forms, client state, API consumption

sakala-api
  -> auth, policy, validation, project/deployment source of truth

sakala-agent
  -> runtime execution: Docker/Railpack/Caddy/logs/health

sakala-infra
  -> local runtime playground and infrastructure contract

sakala-landing
  -> public website, docs, SEO entry point
```

Kalau sebuah logic membutuhkan database, policy, quota, role, deployment command, agent scheduling, atau resource limit, tempatnya bukan di console. Console hanya mengirim intent user dan menampilkan state resmi dari API.
