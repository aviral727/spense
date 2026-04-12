# Spense — Agent / Developer Context

> **Share this file with any AI agent or developer who needs to start working on the project immediately.**
> It contains everything needed to understand, clone, build, and contribute without asking questions.
> Call `get_context` via the MCP server to load this at the start of any session.

---

## 1. What Is This Project?

**Spense** is a privacy-first Android expense tracker built with React Native (Expo). Users log expenses manually, and the app calculates a live "Safe to Spend" daily budget. All data stays on-device — no cloud, no accounts, no network requests.

- **GitHub Repo:** `https://github.com/aviral727/spense`
- **Package ID:** `com.spense.app`
- **Current Version:** `1.1.0` (versionCode 2)
- **Platform:** Android (primary). iOS scaffolded but not a target.
- **Play Store Status:** In review for production (v1.1.0 submission clears previous SMS policy rejections)
- **Design Doc (deep reference):** `Docs/spense_design_doc.md`
- **Privacy Policy:** `PRIVACY_POLICY.md` (also live at the GitHub link above)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Styling | NativeWind v4 (TailwindCSS for RN) |
| Navigation | Expo Router v4 (file-based, like Next.js) |
| Database | Expo SQLite + Drizzle ORM |
| State | React Context API (no Redux/Zustand) |
| Native Java | Widget provider, widget data bridge |
| Storage | SQLite for transactions/settings, AsyncStorage for flags |

---

## 3. Getting the Project Running

### Prerequisites

```bash
node --version   # Need 18+
java -version    # Need JDK 17+
# Android Studio with SDK 34+ installed
# Physical Android device or emulator
```

### Clone & Install

```bash
git clone https://github.com/aviral727/spense.git
cd spense
npm install
```

### Run (IMPORTANT — Expo Go will NOT work)

The project has custom native Java modules (widget bridge). You must use a native build:

```bash
npx expo run:android    # builds + installs on connected device/emulator
```

Dev server only (after the build is already installed):

```bash
npx expo start
```

### Build Release AAB (Play Store)

```bash
cd android && ./gradlew bundleRelease --no-daemon
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Build Release APK (sideload/testing)

```bash
cd android && ./gradlew assembleRelease --no-daemon
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Project Structure

```
spense/
├── app/                        ← All screens (Expo Router file-based)
│   ├── _layout.tsx             ← ROOT: DB init, migrations, notification handlers, onboarding gate
│   ├── (tabs)/
│   │   ├── _layout.tsx         ← Custom floating tab bar (slate/emerald theme)
│   │   ├── index.tsx           ← Home: "Safe to Spend" card + recent transactions
│   │   ├── transactions.tsx    ← Full transaction list
│   │   └── analysis.tsx        ← Spending charts & category breakdown
│   ├── add.tsx                 ← Add transaction manually
│   ├── edit-transaction.tsx    ← Edit/delete/ignore a transaction
│   ├── onboarding.tsx          ← 5-step first-launch wizard (no SMS step)
│   └── settings.tsx            ← Budget config, theme, currency, danger zone
│
├── components/
│   ├── TransactionList.tsx     ← Reusable list (tap=edit, long-press=ignore/delete)
│   └── CategoryPicker.tsx      ← Modal grid picker (supports custom categories)
│
├── context/
│   ├── ThemeContext.tsx         ← light/dark/auto theme via NativeWind
│   └── CurrencyContext.tsx      ← Currency symbol (₹/$€/£/¥) persisted in SQLite
│
├── db/
│   ├── client.ts               ← Drizzle instance — always import `db` from here
│   ├── schema.ts               ← Single source of truth for table definitions
│   └── seed.ts                 ← Seeds 10 default categories on first launch
│
├── services/
│   ├── budgetService.ts        ← Budget calculations + syncWidgetData() bridge
│   └── notificationService.ts  ← Notification setup + budget alerts
│
├── utils/
│   └── categoryRules.ts        ← Keyword-to-category regex map (used in manual add)
│
├── mcp-server/                 ← MCP server for AI agent access to this project
│   ├── src/index.ts            ← 11 tools: read files, git, build, version management
│   ├── build/index.js          ← Compiled output (run this)
│   └── package.json
│
└── android/app/src/main/java/com/spense/app/
    ├── SpenseWidget.java        ← AppWidgetProvider: renders home screen widget
    ├── WidgetDataModule.java    ← RN bridge: JS → SharedPreferences → widget re-render
    ├── SmsListenerPackage.java  ← Registers WidgetDataModule with React Native
    │
    │   ── Dead code (kept but unregistered, safe to ignore): ──
    ├── SmsListenerModule.java
    ├── SmsBroadcastReceiver.java
    ├── SmsBackgroundService.java
    └── BackgroundSyncModule.java
```

---

## 5. Database Schema

SQLite file: `moneytracker.db` (on-device, never synced)

### `transactions`

```sql
id                   INTEGER PRIMARY KEY AUTOINCREMENT
amount               REAL NOT NULL
category             TEXT NOT NULL          -- matches categories.name
description          TEXT                   -- user note or merchant name
date                 INTEGER NOT NULL       -- Unix timestamp in MILLISECONDS
type                 TEXT NOT NULL          -- 'expense' | 'income'
source               TEXT DEFAULT 'manual'  -- always 'manual' in v1.1.0
transaction_class    TEXT                   -- 'spending' | 'refund' | etc. (legacy, set to 'spending')
linked_transaction_id INTEGER              -- unused in v1.1.0
raw_sms_hash         TEXT                   -- unused in v1.1.0
account              TEXT                   -- unused in v1.1.0
is_ignored           INTEGER DEFAULT 0      -- 1 = excluded from budget, still visible
```

### `categories`

```sql
id    INTEGER PRIMARY KEY AUTOINCREMENT
name  TEXT NOT NULL UNIQUE
icon  TEXT    -- emoji (e.g. '🍔')
```

### `settings` (key-value store)

| key | example value |
|---|---|
| `monthly_budget` | `"30000"` |
| `start_day` | `"1"` (1–28, day budget resets each month) |
| `budget_mode` | `"dynamic"` or `"fixed"` |
| `currency` | `"₹"` |
| `alert_daily_90_YYYY-MM-DD` | `"sent"` (dedup flag for notifications) |

### AsyncStorage Keys (not SQLite)

| Key | Description |
|---|---|
| `onboarding_completed` | `"true"` once wizard finishes |
| `user-theme` | `"light"` / `"dark"` |
| `auto-theme` | `"true"` = follows system theme |

---

## 6. Key Flows

### Manual Transaction Entry

```
User taps + (in app OR widget button)
  → app/add.tsx opens (or deep-link spense://add)
  → User enters amount, picks category, adds note
  → db.insert(transactions) with source='manual'
  → checkBudgetAlerts() → notification if near threshold
  → syncWidgetData() fires on next home screen load (5s poll)
```

### Budget Calculation

```
budgetService.ts :: calculateDailyBudget()
  → reads settings: monthlyLimit, startDay, budgetMode
  → getCurrentPeriod(startDay) → { start, end }
  → SELECT all transactions, filter: in period + not ignored
  → net spending = sum(expense) - sum(refunds)
  → Dynamic: dailyLimit = (monthlyLimit - netSpending) / daysLeft
  → Fixed:   dailyLimit = (monthlyLimit / totalDays) - spentToday
```

### Widget Data Sync

```
Home screen loads / 5s poll fires
  → calculateDailyBudget() runs
  → syncWidgetData(status, currency) called (budgetService.ts)
  → WidgetDataModule (Java bridge) writes to SharedPreferences
  → SpenseWidget.java re-renders with new values
  → Widget shows live "Safe to Spend" figure
```

### Widget Deep Links

```
Tap [+] on widget  →  spense://add  →  MainActivity  →  /add screen
Tap card body      →  spense://     →  MainActivity  →  Home screen
```

### Budget Alert Dedup

Alerts at 90% fire at most once per day. A sent-flag is stored in the `settings` table: `alert_daily_90_YYYY-MM-DD = "sent"`.

---

## 7. Home Screen Widget

| Property | Value |
|---|---|
| Size | 2×2 grid cells |
| Auto-update interval | 30 minutes (system-triggered) |
| Live update trigger | Every time the app is opened (5s poll) |
| Data bridge | `SharedPreferences` (`SpenseWidgetPrefs`) |
| Layout file | `android/app/src/main/res/layout/spense_widget.xml` |
| Provider info | `android/app/src/main/res/xml/spense_widget_info.xml` |
| Background | `#0f172a` → `#1e293b` gradient (slate-900 → slate-800) |
| Button color | `#059669` (emerald-600) |

The widget is registered in `AndroidManifest.xml` as a `<receiver>` with the `APPWIDGET_UPDATE` action.

---

## 8. Color System (v1.1.0)

The app uses a **slate + emerald** palette inspired by the widget's dark card design.

| Role | Light mode | Dark mode |
|---|---|---|
| Page background | `slate-50` / `#f8fafc` | `slate-950` / `#020617` |
| Card background | `white` | `slate-800` / `#1e293b` |
| Card background (deep) | `white` | `slate-900` / `#0f172a` |
| Primary text | `slate-900` | `white` |
| Secondary text | `slate-500` | `slate-400` |
| Border | `slate-200` | `slate-700` |
| Brand primary | `emerald-600` / `#059669` | `emerald-500` / `#10b981` |
| Brand accent | `emerald-500` / `#10b981` | `emerald-400` / `#34d399` |
| Tab bar background | `#ffffff` | `#0f172a` |
| Tab bar border | `#f1f5f9` | `#1e293b` |

**Rule:** Always pair light/dark: `text-slate-900 dark:text-white`, `bg-white dark:bg-slate-800`.  
Inline `style={{}}` only for shadows, elevation, or conditional values that NativeWind can't handle.

---

## 9. Coding Conventions

| Convention | Rule |
|---|---|
| **Styling** | NativeWind `className` for layout/color. Inline `style={{}}` for elevation, shadows, dynamic hex values |
| **Colors** | Use slate palette (see §8). Brand green: `#059669`. Avoid stone/gray backgrounds. |
| **DB access** | Use `db` (Drizzle) from `db/client.ts`. Raw `expoDb.execAsync()` only in migrations and `_layout.tsx` notification handlers |
| **Naming** | Drizzle schema: camelCase (`isIgnored`). SQLite columns: snake_case (`is_ignored`). Drizzle maps automatically. |
| **Services vs Utils** | Services can import db + utils. Utils are pure functions — no imports from services. Never import upward. |
| **State** | No global state library. React Context for theme/currency. Local `useState` for everything else. |
| **Migrations** | Add columns as `ALTER TABLE ADD COLUMN` in a try/catch inside `_layout.tsx`. Drizzle Kit generates SQL only — it does not run migrations automatically. |
| **Navigation** | `useRouter()` from `expo-router`. `router.push('/screen')` or `router.replace()` for tab switches. |
| **Widget updates** | Call `syncWidgetData(status, currency)` whenever `calculateDailyBudget()` is called — already wired into home screen poll. |

---

## 10. Critical Gotchas

> **NEVER use Expo Go** — custom native modules (`WidgetDataModule`, `SpenseWidget`) are not available outside a native build. Always use `npx expo run:android` or a release build.

> **date fields are milliseconds** — All `date` values in SQLite are Unix timestamps in **milliseconds**. Use `Date.now()`, never `Math.floor(Date.now() / 1000)`.

> **Column naming mismatch** — Drizzle schema uses `isIgnored` (camelCase) but raw SQL must use `is_ignored` (snake_case). Same for `transactionClass` / `transaction_class`.

> **Notification handlers are in `_layout.tsx`** — The 3 notification actions (Name/Ignore/Delete) live in `Notifications.addNotificationResponseReceivedListener` in the root layout, NOT in `notificationService.ts`.

> **Budget loads all transactions** — `calculateDailyBudget()` does `SELECT *` and filters in JS. Fine at current scale; revisit if table grows large.

> **Widget data is one-way** — The widget reads from `SharedPreferences`. It cannot write back to JS. All writes go through the app.

> **SMS code is dead but present** — `SmsListenerModule.java`, `SmsBroadcastReceiver.java`, `SmsBackgroundService.java`, `BackgroundSyncModule.java` are in the source tree but unregistered and unreachable. They can be safely deleted in a future cleanup. Do not re-register them — it would cause Play Store rejection.

> **No SMS permissions** — `READ_SMS` and `RECEIVE_SMS` were deliberately removed in v1.1.0 to resolve Play Store policy rejections. Do not add them back.

---

## 11. Where to Find Things

| Task | File(s) |
|---|---|
| Change budget calculation logic | `services/budgetService.ts` → `calculateDailyBudget()` |
| Sync data to widget | `services/budgetService.ts` → `syncWidgetData()` |
| Change widget layout/design | `android/.../res/layout/spense_widget.xml` |
| Change widget colors/drawables | `android/.../res/drawable/widget_*.xml` |
| Change widget provider config (size, update interval) | `android/.../res/xml/spense_widget_info.xml` |
| Change widget native rendering | `android/.../SpenseWidget.java` |
| Change widget JS↔Native bridge | `android/.../WidgetDataModule.java` |
| Add / change category auto-detection | `utils/categoryRules.ts` → `CATEGORY_RULES` |
| Add a new notification action | `services/notificationService.ts` (register) + `app/_layout.tsx` (handle) |
| Add a new screen | Create `app/new-screen.tsx` + add `<Stack.Screen>` in `app/_layout.tsx` |
| Add a new DB column | `db/schema.ts` + `ALTER TABLE ADD COLUMN` in `app/_layout.tsx` |
| Add a default category | `db/seed.ts` → `defaultCategories` array |
| Change tab bar | `app/(tabs)/_layout.tsx` → `CustomTabBar` |
| Change "Safe to Spend" card | `app/(tabs)/index.tsx` |
| Change analysis/charts | `app/(tabs)/analysis.tsx` |
| Change notification content | `services/notificationService.ts` → `checkBudgetAlerts()` |
| Add a new MCP tool | `mcp-server/src/index.ts` → add to tool list + handler → `npm run build` |

---

## 12. Feature State (v1.1.0 — April 2026)

### ✅ Implemented & Working

- Manual transaction entry (amount, category, note, type, ignore flag)
- Category auto-suggestion from description keywords
- Monthly budget with configurable reset day (1–28)
- Dynamic & Fixed daily budget modes
- "Safe to Spend" card (auto-refreshes every 5s)
- Budget alerts at 90% threshold (daily & monthly, deduped)
- Tap to edit any transaction
- Long-press for quick Ignore / Delete
- Notification actions: ✏️ Name, 🙈 Ignore, 🗑️ Delete
- Custom categories with emoji icons
- Spending analysis: category breakdown, daily chart, top merchants
- Dark mode (manual + system auto-follow) — slate/emerald color scheme
- Multi-currency (₹, $, €, £, ¥)
- **Home screen widget** — live "Safe to Spend" + [+] button (deep-links to add screen)
- 5-step onboarding wizard
- 100% on-device — no cloud, no accounts, no network requests
- MCP server (`mcp-server/`) — 11 tools for AI agent access

### ❌ Removed in v1.1.0

- Real-time SMS auto-tracking
- Historical SMS import
- Auto-sync toggle in settings
- 6th onboarding step (SMS import choice)
- `auto-import.tsx` screen
- `READ_SMS` / `RECEIVE_SMS` permissions

### 🔮 Planned / Future

- CI/CD pipeline (GitHub Actions → Play Store via `r0adkll/upload-google-play`)
- Notification Listener as a policy-compliant alternative to SMS (future)
- Recurring transactions
- Export to CSV

---

## 13. MCP Server (for AI Agents)

The project ships a ready-to-use MCP server at `mcp-server/`. Connect any MCP-compatible agent to it for full project access.

### Run it

```bash
cd mcp-server && npm install && npm run build
# Then configure your agent to run: node mcp-server/build/index.js
```

### Claude Desktop config (`~/.config/claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "spense": {
      "command": "node",
      "args": ["/absolute/path/to/spense/mcp-server/build/index.js"]
    }
  }
}
```

### Available tools

`get_context` · `read_file` · `list_files` · `git_log` · `git_status` · `git_commit_push` · `get_version` · `bump_version` · `build_release_aab` · `build_release_apk` · `get_build_artifacts`

---

## 14. Useful Resources

| Resource | Link |
|---|---|
| GitHub Repository | https://github.com/aviral727/spense |
| Privacy Policy | https://github.com/aviral727/spense/blob/main/PRIVACY_POLICY.md |
| Full Design Doc | `Docs/spense_design_doc.md` (in this repo) |
| Expo Router Docs | https://expo.github.io/router |
| Drizzle ORM Docs | https://orm.drizzle.team/docs/get-started-sqlite |
| NativeWind Docs | https://www.nativewind.dev |
| Expo Notifications | https://docs.expo.dev/versions/latest/sdk/notifications |
| MCP SDK Docs | https://modelcontextprotocol.io/docs |
