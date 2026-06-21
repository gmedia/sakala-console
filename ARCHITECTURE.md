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

## Server State

TanStack Query menyimpan data API seperti user, projects, deployments, dan logs. Svelte runes menyimpan state lokal seperti mobile navigation, selected tab, dan draft UI yang belum dikirim.

Satu data domain tidak boleh disalin ke global store manual karena akan menghasilkan cache kedua yang mudah stale.

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

## Realtime

Laravel Echo dan Pusher client belum menjadi dependency. Keduanya ditambahkan setelah API menyediakan Reverb configuration, private channel authorization, event names, dan reconnect behavior yang dapat diuji.
