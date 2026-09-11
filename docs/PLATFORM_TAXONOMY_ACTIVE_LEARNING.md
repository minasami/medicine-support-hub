# Platform taxonomy active learning

## Purpose

Submit & Add Product Portfolio searchable pickers must grow a **shared** catalog of
dosage forms, routes, categories, drug classes, scientific APIs (ingredients),
strength patterns, and product lines. When a company user chooses **+ Add new**,
that value is written to Appwrite so **other users** see it on their next load.

Trade names stay **company-scoped** (portfolio create/claim path). They are not
dumped into the global taxonomy.

## Root cause (pre-fix)

PR #164 added `SearchableCombobox` / `SearchableMultiCombobox` with Add new, but
Add new only updated **local React state**. Option lists were loaded through
`supabaseFetch` REST facet paths that either missed the Appwrite interceptor or
fell back to static Egyptian samples — not durable global taxonomy.

## Storage

| Collection | Role |
|---|---|
| `platform_taxonomy` | Source of truth for global picker values (user adds + seeded aggregates) |
| `medicines` | Live catalog; used to seed aggregates and enrich ingredient↔class hints |

### `platform_taxonomy` fields

- `kind` — `dosage_form` \| `route` \| `category` \| `drug_class` \| `ingredient` \| `strength` \| `product_line`
- `value` — display string
- `value_key` — lowercased trimmed key (case-insensitive dedupe)
- `source` — `user_add` \| `medicines_aggregate` \| `seed`
- `created_by` — user id / email / `seed`
- `usage_count` — increments on re-add

Unique index: `(kind, value_key)`.

## Permissions

- `read("any")` — anonymous clients can load picker options
- `create("users")` + `create("any")` — authenticated (and anonymous) clients may add values
- `update("users")` + `update("any")` — usage_count bumps / casing refresh

API keys stay **server-only** (scripts / admin routes). Never ship `APPWRITE_API_KEY` in Vite client env.

## Client flow

1. `loadTaxonomyOptions(kind)` lists Appwrite docs (paged) + merges a local overlay cache.
2. Combobox `onAddNew` → `persistTaxonomyValue(kind, value)`:
   - updates memory + `localStorage` overlay immediately
   - upserts Appwrite doc (lookup by kind+value_key, else create)
3. Product submit also re-persists any custom values typed without Add new.
4. Ranked search (`filterAndRankComboboxOptions`) still applies on the merged list.

## Seeding / ops

```bash
APPWRITE_API_KEY=… node scripts/seed-platform-taxonomy.mjs
```

Scans `medicines` distinct field values (and parses combo scientific names into
`ingredient` atoms), then upserts into `platform_taxonomy`.

## Verify

1. User A: open Submit & Add Product Portfolio → Dosage Form → **+ Add new** → `Lyophilized Ampoule X`.
2. Confirm it appears in User A’s picker immediately.
3. User B (other browser / cleared site data): reload form → search `Lyophilized` → value appears from DB.
4. Trade name Add new still only affects company portfolio create (not global taxonomy).

## Related code

- `apps/web/src/lib/platform-taxonomy.ts`
- `apps/web/src/components/ui/searchable-combobox.tsx` (`onAddNew`)
- `apps/web/src/components/ui/searchable-multi-combobox.tsx` (`onAddNew`)
- `apps/web/src/components/company-medicine-addition-form.tsx`
