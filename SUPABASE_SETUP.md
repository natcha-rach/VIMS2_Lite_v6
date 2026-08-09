# VIMS2 Lite — Supabase Setup

## 1) Project URL

Use the Supabase **Project URL** only:

`https://cphhutlxvbinaycmsekm.supabase.co`

Do **not** use:

`https://cphhutlxvbinaycmsekm.supabase.co/rest/v1/`

`createClient()` needs the project root URL and handles REST/Storage/Auth endpoints internally.

## 2) Frontend key

`assets/js/supabaseClient.js` contains the project's **anon/public** key.

Never put a `service_role` / secret key in frontend code.

## 3) Database

For a fresh/empty database, run:

`sql/schema.sql`

Do not run the old incremental migrations v2-v9 on top of the fresh schema.

## 4) Storage

Bucket required:

`item-images`

The current project expects this bucket name exactly.

## 5) Quick verification

After opening the app, test in this order:

1. Dashboard loads without a Supabase error.
2. Create one Lot.
3. Create one Lot Group.
4. Create one Item.
5. Upload 1 image.
6. Open Item and verify image appears.
7. Sell the test Item.
8. Verify Item becomes `sold` and a row appears in `sales`.

If step 1 fails, open browser DevTools → Console and Network and inspect the first Supabase error.
