# Spense — Agent / Developer Context

> **Share this file with any AI agent or developer who needs to start working on the project immediately.** It contains everything needed to understand the project, clone it, run it, and contribute without needing to ask questions.

---

## 1. What Is This Project?

**Spense** is a privacy-first Android expense tracking app built with React Native (Expo). It automatically parses bank SMS messages to track spending, with zero cloud involvement — all processing happens on-device.

- **GitHub Repo:** `https://github.com/aviral727/spense`
- **Package ID:** `com.spense.app`
- **Current Version:** 1.0.0
- **Platform:** Android only (iOS is scaffolded but SMS APIs are Android-exclusive)
- **Design Doc (deep reference):** `Docs/spense_design_doc.md` in this repo

---

## 2. Tech Stack (Quick Reference)

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Styling | NativeWind v4 (TailwindCSS for RN) |
| Navigation | Expo Router v6 (file-based, like Next.js) |
| Database | Expo SQLite + Drizzle ORM |
| State | React Context API (no Redux/Zustand) |
| Native | Custom Java modules (SMS listener, background service) |
| Storage | SQLite for transactions/settings, AsyncStorage for flags |

---

## 3. Getting the Project Running

### Prerequisites

```bash
node --version   # Need 18+
java -version    # Need JDK 17+
# Android Studio with SDK 34+ installed
# Physical Android device or emulator running
```

### Clone & Install

```bash
git clone https://github.com/aviral727/spense.git
cd spense
npm install
```

### Run (IMPORTANT — Expo Go will NOT work)

This project has **custom native Java modules** for SMS. You must use a development build:

```bash
npx expo run:android    # builds + installs on connected device/emulator
```

Dev server only (once the build is already on the device):

```bash
npx expo start
```

### Build Release APK

```bash
npx expo export -p android -c
cd android && ./gradlew assembleRelease --no-daemon
# APK: android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

---

## 4. Project Structure (Quick Map)

```
spense/
├── app/                    ← All screens (Expo Router file-based)
│   ├── _layout.tsx         ← ROOT: DB init, migrations, notification handlers, onboarding gate
│   ├── (tabs)/
│   │   ├── _layout.tsx     ← Custom floating tab bar
│   │   ├── index.tsx       ← Home: "Safe to Spend" card + recent transactions
│   │   ├── transactions.tsx← All transactions list
│   │   └── analysis.tsx    ← Spending charts & breakdown
│   ├── add.tsx             ← Add transaction manually
│   ├── edit-transaction.tsx← Edit/delete/ignore a transaction
│   ├── auto-import.tsx     ← Historical SMS import with date picker
│   ├── onboarding.tsx      ← 6-step first-launch wizard
│   └── settings.tsx        ← Budget config, sync toggle, theme, currency
│
├── components/
│   ├── TransactionList.tsx  ← Reusable list (tap=edit, long-press=ignore/delete)
│   └── CategoryPicker.tsx   ← Modal grid picker (supports adding new categories)
│
├── context/
│   ├── ThemeContext.tsx     ← light/dark/auto theme via NativeWind
│   └── CurrencyContext.tsx  ← Currency symbol (₹/$/ €/£/¥) from SQLite
│
├── db/
│   ├── client.ts           ← Drizzle instance (import `db` from here)
│   ├── schema.ts           ← Single source of truth for table definitions
│   └── seed.ts             ← Seeds 10 default categories on first launch
│
├── services/               ← Business logic (can have side effects)
│   ├── autoSync.ts         ← SMS listener orchestrator (init/start/stop/missed sync)
│   ├── budgetService.ts    ← Budget calculations & period logic
│   ├── notificationService.ts ← Notification setup + budget alerts
│   └── smsReader.ts        ← Historical bulk SMS reading
│
├── utils/                  ← Pure functions (no side effects)
│   ├── smsParser.ts        ← Raw SMS text → ParsedTransaction
│   ├── transactionProcessor.ts ← Classification, dedup, transfer detection
│   └── categoryRules.ts    ← Keyword-to-category regex map
│
└── android/app/src/main/java/com/spense/app/
    ├── SmsListenerModule.java      ← RN bridge: start/stop dynamic receiver
    ├── SmsBroadcastReceiver.java   ← Intercepts SMS_RECEIVED, forwards to JS
    ├── SmsBackgroundService.java   ← Foreground service (keeps sync alive when closed)
    ├── BackgroundSyncModule.java   ← RN bridge: start/stop foreground service
    └── SmsListenerPackage.java     ← Registers both modules with React Native
```

---

## 5. Database Schema

SQLite file: `moneytracker.db` (on-device only, never synced)

### `transactions`

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
amount REAL NOT NULL
category TEXT NOT NULL               -- matches categories.name
description TEXT                     -- merchant name or user label
date INTEGER NOT NULL                -- Unix timestamp in MILLISECONDS
type TEXT NOT NULL                   -- 'expense' | 'income'
source TEXT DEFAULT 'manual'         -- 'manual' | 'sms'
transaction_class TEXT               -- 'spending'|'income'|'salary'|'transfer'|'refund'|'atm'|'cc_payment'
linked_transaction_id INTEGER        -- paired transaction (transfers/refunds)
raw_sms_hash TEXT                    -- deduplication hash
account TEXT                         -- last 4 digits of card/account
is_ignored INTEGER DEFAULT 0         -- 1 = excluded from budget, still visible
```

### `categories`

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
icon TEXT                            -- emoji (e.g. '🍔')
```

### `settings`

Key-value store for app config. Important keys:

| key | example value |
|---|---|
| `monthly_budget` | `"30000"` |
| `start_day` | `"1"` (1–28, day budget resets) |
| `budget_mode` | `"dynamic"` or `"fixed"` |
| `currency` | `"₹"` |
| `alert_daily_90_YYYY-MM-DD` | `"sent"` (dedup flag) |

### AsyncStorage Keys (not SQLite)

| Key | Description |
|---|---|
| `onboarding_completed` | `"true"` once wizard is done |
| `autoSyncEnabled` | `"true"` / `"false"` |
| `lastSyncTimestamp` | Unix ms of last sync |
| `installationTimestamp` | Unix ms of first launch |
| `user-theme` | `"light"` / `"dark"` |
| `auto-theme` | `"true"` follows system theme |

---

## 6. Key Flows to Understand

### Real-Time SMS → Transaction

```
Android SMS_RECEIVED
  → SmsBroadcastReceiver.java (extracts sender, body, timestamp)
  → emits "onSmsReceived" to JS via RCTDeviceEventEmitter
  → autoSync.ts :: handleIncomingSms()
  → smsParser.ts :: isTransactionSMS() → parseSMSTransaction()
  → transactionProcessor.ts :: processTransactions() (classification)
  → Filter: only expenses (income is intentionally ignored)
  → Dedup via rawSmsHash
  → INSERT into transactions table
  → notificationService.ts :: checkBudgetAlerts()
```

### Budget Calculation

```
budgetService.ts :: calculateDailyBudget()
  → reads settings: monthlyLimit, startDay, budgetMode
  → getCurrentPeriod(startDay) → {start, end}
  → SELECT all transactions, filter: in period + not ignored
  → net spending = sum(spending class) - sum(refund class)
  → Dynamic: dailyLimit = (monthlyLimit - netSpending) / daysLeft
  → Fixed:   dailyLimit = (monthlyLimit / totalDays) - spentToday
```

### Budget Alert Dedup

Alerts at 90% threshold fire at most ONCE per day (daily) or per month-slot (monthly). They store a sent-flag in the `settings` table with key `alert_daily_90_YYYY-MM-DD`.

---

## 7. Coding Conventions

| Convention | Rule |
|---|---|
| **Styling** | NativeWind `className` for most things. Inline `style={{}}` only for dynamic values (shadows, conditional colors, elevation) |
| **Colors** | Emerald green is the brand: `#059669` (primary), `#10b981` (accent), `#34d399` (light). Dark bg: `#0c0a09` / `#111827` |
| **Dark mode** | Always use paired classes: `text-gray-900 dark:text-white`, `bg-white dark:bg-gray-900` |
| **DB access** | Use `db` (Drizzle) from `db/client.ts`. Raw `expoDb.execAsync()` only for migrations or notification handlers |
| **Naming** | Drizzle schema uses camelCase (`transactionClass`), but SQLite columns are snake_case (`transaction_class`) — Drizzle maps them |
| **Services vs Utils** | Services can import from utils + db. Utils are pure and import nothing from services. Never import upward. |
| **State** | No global state library. Use React Context for cross-cutting concerns (theme, currency). Local `useState` for everything else. |
| **Migrations** | Add new columns as `ALTER TABLE ADD COLUMN` wrapped in try/catch inside `_layout.tsx`. Drizzle Kit is only for generating migration SQL files — it does NOT run them automatically. |
| **Navigation** | Use `useRouter()` from `expo-router`. Push with `router.push('/screen-name')`. Params via `router.push({ pathname, params })`. |

---

## 8. Critical Gotchas

> **NEVER use Expo Go** — it crashes because `SmsListenerModule` and `BackgroundSyncModule` are not available outside a dev/production build.

> **date fields are milliseconds** — All `date` values in the DB are Unix timestamps in **milliseconds**, not seconds. Always use `Date.now()` or `sms.timestamp` (already ms).

> **Column naming mismatch** — Drizzle schema has `transactionClass` (camelCase) but the actual SQLite column is `transaction_class` (snake_case). Raw SQL queries must use snake_case.

> **Budget loads all transactions** — `calculateDailyBudget()` does `SELECT *` on the transactions table and filters in JavaScript. Fine for current scale, but watch out if the table grows large.

> **Notification handlers are in `_layout.tsx`** — The 3 notification actions (Name/Ignore/Delete) are handled via `Notifications.addNotificationResponseReceivedListener` in the root layout, NOT in `notificationService.ts`.

> **Income is intentionally not auto-imported** — `handleIncomingSms` and `syncMissedSMS` both drop `type === 'income'` transactions. Only debits are auto-saved. This is a deliberate design choice.

> **Background service on some OEMs** — Xiaomi, Samsung, Huawei may kill the `SmsBackgroundService`. Users need to whitelist Spense from battery optimization manually.

---

## 9. Where to Find Things (Quick Lookup)

| Task | File(s) |
|---|---|
| Add a new bank sender for SMS parsing | `utils/smsParser.ts` → `KNOWN_SENDERS` array |
| Add a new SMS keyword (debit/credit/ignore) | `utils/smsParser.ts` → `TXN_KEYWORDS` / `IGNORE_KEYWORDS` |
| Add / change category auto-detection | `utils/categoryRules.ts` → `CATEGORY_RULES` |
| Change transaction classification logic | `utils/transactionProcessor.ts` → `classifyTransaction()` |
| Change budget calculation logic | `services/budgetService.ts` → `calculateDailyBudget()` |
| Add a new notification action | `services/notificationService.ts` (register) + `app/_layout.tsx` (handle) |
| Add a new screen | Create `app/new-screen.tsx` + add `<Stack.Screen>` in `app/_layout.tsx` |
| Add a new DB column | `db/schema.ts` + add `ALTER TABLE ADD COLUMN` in `app/_layout.tsx` |
| Add a default category | `db/seed.ts` → `defaultCategories` array |
| Change tab bar appearance | `app/(tabs)/_layout.tsx` → `CustomTabBar` component |
| Change the "Safe to Spend" card | `app/(tabs)/index.tsx` |
| Change analysis/charts | `app/(tabs)/analysis.tsx` |
| Change notification content | `services/notificationService.ts` → `checkBudgetAlerts()` |

---

## 10. Feature State (v1.0.0 — as of March 2026)

All features below are **fully implemented and working**:

- ✅ Real-time SMS auto-tracking (foreground + background)
- ✅ Historical SMS import with date range + UI selection
- ✅ SMS parsing for Indian banks (HDFC, ICICI, SBI, Axis, UPI, Paytm, etc.)
- ✅ Transaction intelligence (spending / transfer / refund / ATM / CC payment / salary)
- ✅ SmS deduplication via hash
- ✅ Monthly budget with configurable reset day (1–28)
- ✅ Dynamic & Fixed daily budget modes
- ✅ "Safe to Spend" card (refreshes every 5s)
- ✅ Budget alerts at 90% (daily & monthly, deduped)
- ✅ Manual transaction entry
- ✅ Tap to edit any transaction
- ✅ Long-press for Ignore / Delete
- ✅ Notification actions: ✏️ Name, 🙈 Ignore, 🗑️ Delete
- ✅ Custom categories with emoji icons
- ✅ Spending analysis: category breakdown, daily chart, top merchants
- ✅ Dark mode (manual + system auto-follow)
- ✅ Multi-currency (₹, $, €, £, ¥)
- ✅ 6-step onboarding wizard
- ✅ 100% on-device — no cloud, no accounts, no network requests

---

## 11. Useful Resources

| Resource | Link |
|---|---|
| GitHub Repository | https://github.com/aviral727/spense |
| Privacy Policy | https://github.com/aviral727/spense/blob/main/PRIVACY_POLICY.md |
| Full Design Doc | `Docs/spense_design_doc.md` (in this repo) |
| Expo Router Docs | https://expo.github.io/router |
| Drizzle ORM Docs | https://orm.drizzle.team/docs/get-started-sqlite |
| NativeWind Docs | https://www.nativewind.dev |
| Expo Notifications | https://docs.expo.dev/versions/latest/sdk/notifications |
