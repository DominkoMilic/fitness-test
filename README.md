# Krešimir Fit Tracker — Next.js

Next.js 16 + React 19 + Tailwind v4 + TypeScript port of the legacy single-file PWA.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill values
npm run dev
```

## Env vars

| Var                             | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable anon key                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | server-side admin sync insert/delete access |
| `NEXT_PUBLIC_ADMIN_PASSWORD`    | client-side admin gate                      |
| `NEXT_PUBLIC_SYNC_SHEET_ID`     | Google Sheet ID for foods sync              |
| `NEXT_PUBLIC_SYNC_SHEET_GID`    | gid of the sheet tab                        |

## Folder structure

```
app/                      # Next.js App Router routes
  layout.tsx              # root shell (Toast, Loading)
  page.tsx                # bootstrap → /login or /dashboard
  login/                  # public login screen
  admin/                  # admin (codes + sheet sync)
  (main)/                 # auth-gated app shell w/ header + bottom nav
    layout.tsx
    dashboard/
    search/
    favorites/

components/
  ui/                     # Toast, Loading, Modal, Button, Input
  layout/                 # Header, BottomNav
  auth/                   # LoginForm
  dashboard/              # CalorieRing, DayNav, MacroPills, MealCard, MealsList, FoodLogItem
  search/                 # SearchBar, FoodResultItem, HistoryList, BarcodeScanner
  favorites/              # FavTabs, FavCard
  modals/                 # AddFoodModal, EditFoodModal, GoalModal, SaveFavModal, AddFavModal, SyncPreviewModal
  admin/                  # CodeForm, CodeList, SyncSection

hooks/                    # useFoods, useFoodLogs, useFavorites, useHistory
store/                    # zustand stores: useAuthStore, useUIStore, useDayStore

lib/
  supabase/               # typed client
  api/                    # codes, foodLogs, favorites, foods, openFoodFacts, sheetSync
  utils/                  # date, normalize, csv, macros
  constants/              # meals, pieces, defaultFoods (fallback)

types/                    # database (Supabase row types), app (UI types)
```

## Supabase types

`types/database.ts` is hand-written. Once the Supabase CLI is wired in:

```bash
npx supabase gen types typescript --project-id <id> > types/database.ts
```

## Notes

- Auth is the legacy "access code" pattern (table `codes`), persisted to `localStorage` (`kf_saved_code`).
- History (last 20 foods per code) and food cache (2 h TTL) live in `localStorage`.
- Barcode scan uses native `BarcodeDetector` → Open Food Facts. Chrome-on-Android only.
- Sheet sync pulls a public CSV export of a Google Sheet, diffs against `foods.name`, inserts new rows.
- Admin password is client-side gate only — Supabase RLS must be the real boundary.
