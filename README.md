# Purchase Request Toko

Web app administrasi purchase request harian untuk toko, staff, admin, dan vendor.

## Stack

- Next.js untuk aplikasi web.
- Supabase Auth untuk login.
- Supabase Postgres untuk database.
- Supabase Storage untuk upload struk vendor.
- Vercel untuk hosting gratis.

## Fitur MVP

- Login untuk admin, staff toko, dan vendor.
- Staff/admin membuat purchase request harian.
- Satu tanggal bisa memiliki banyak request.
- Satu request bisa berisi banyak barang dan vendor.
- Report harian vendor yang direquest.
- Vendor login untuk update status item.
- Vendor upload struk per item.

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat project di Supabase, lalu jalankan SQL di `supabase/schema.sql` melalui SQL Editor Supabase.

3. Salin `.env.example` menjadi `.env.local`, lalu isi:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Jalankan aplikasi:

```bash
npm run dev
```

## Setup User

1. Buat user di Supabase Auth.
2. Tambahkan baris di tabel `profiles` dengan `id` yang sama dengan user Auth.
3. Untuk vendor, buat data di `vendors`, lalu hubungkan user vendor di `vendor_users`.

Contoh role:

- `admin`: mengelola master data dan melihat semua request.
- `staff`: membuat request dan melihat report.
- `vendor`: melihat item untuk vendornya, update status, dan upload struk.

## Master Data

Master brand masuk ke tabel `brands`.

Kolom utama:

- `name`
- `is_active`

Master barang masuk ke tabel `products`.

Kolom utama:

- `brand_id`
- `sku`
- `name`
- `unit`
- `is_active`

Master vendor masuk ke tabel `vendors`.

Kolom utama:

- `name`
- `contact_name`
- `phone`
- `is_active`

Data bisa diimpor lewat Supabase Table Editor dari CSV.

## Deploy Gratis

1. Push repo ke GitHub.
2. Import repo di Vercel.
3. Tambahkan environment variables dari `.env.local` ke Vercel.
4. Deploy.

Domain gratis akan berupa `nama-project.vercel.app`. Kalau nanti ingin domain sendiri, bisa dibeli terpisah dan diarahkan ke Vercel.
