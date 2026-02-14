# Spense - Smart Expense Tracker

**Spense** is a privacy-focused expense tracking app that automatically reads bank SMS messages to track your spending. All data is processed locally on your device - nothing is uploaded to any server.

## 📱 Features

- **Automatic SMS Parsing**: Reads bank SMS messages and extracts transaction details
- **Smart Categorization**: AI-powered transaction categorization
- **Budget Tracking**: Set monthly budgets with dynamic or fixed daily limits
- **Edit & Ignore**: Tap any transaction to edit it, long-press for quick actions
- **Notification Actions**: Name, Ignore, or Delete transactions directly from notifications
- **Privacy First**: 100% on-device processing, no data leaves your phone
- **Dark Mode**: Full dark mode support
- **Multi-currency**: Support for ₹, $, €, £, ¥

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React Native with Expo (SDK 54) |
| **Styling** | NativeWind (TailwindCSS for React Native) |
| **Database** | Expo SQLite with Drizzle ORM |
| **Navigation** | Expo Router v6 (File-based routing) |
| **State** | React Context API |
| **Native Modules** | Custom Java modules for SMS listening |

### Project Structure

```
spense/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── _layout.tsx           # Custom floating tab bar
│   │   ├── index.tsx             # Home screen (budget overview)
│   │   ├── transactions.tsx      # Full transaction list
│   │   └── analysis.tsx          # Spending analysis
│   ├── add.tsx                   # Add transaction manually
│   ├── edit-transaction.tsx      # Edit existing transaction
│   ├── onboarding.tsx            # First-time setup wizard
│   ├── settings.tsx              # App settings
│   └── _layout.tsx               # Root layout + notification handler
├── components/                   # Reusable UI components
│   └── TransactionList.tsx       # Transaction list (tap=edit, long-press=actions)
├── context/                      # React Context providers
│   ├── ThemeContext.tsx          # Light/dark theme management
│   └── CurrencyContext.tsx       # Currency selection
├── db/                           # Database layer
│   ├── client.ts                 # Drizzle ORM client
│   ├── schema.ts                 # Database schema
│   └── seed.ts                   # Default categories
├── services/                     # Business logic
│   ├── autoSync.ts               # SMS auto-sync service
│   ├── budgetService.ts          # Budget calculations
│   ├── notificationService.ts    # Notifications (Name/Ignore/Delete actions)
│   └── smsReader.ts              # SMS reading logic
├── utils/                        # Utilities
│   ├── smsParser.ts              # Bank SMS parsing patterns
│   └── transactionProcessor.ts   # Transaction intelligence
├── android/                      # Native Android code
│   └── app/src/main/java/com/spense/app/
│       ├── SmsListenerModule.java      # RN bridge for SMS
│       ├── SmsBroadcastReceiver.java   # Background SMS listener
│       ├── SmsBackgroundService.java   # Foreground service
│       ├── BackgroundSyncModule.java   # Background sync control
│       └── SmsListenerPackage.java     # RN package registration
└── assets/                       # Static assets (icons, images)
```

## 🗄️ Database Schema

### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  date INTEGER NOT NULL,
  type TEXT NOT NULL,           -- 'expense' | 'income'
  source TEXT DEFAULT 'manual', -- 'manual' | 'sms'
  transaction_class TEXT,       -- 'spending' | 'income' | 'transfer' | 'refund'
  raw_sms_hash TEXT,            -- Hash for SMS deduplication
  account TEXT,                 -- Last 4 digits of account/card
  is_ignored INTEGER DEFAULT 0  -- User manually excluded from budget
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);
```

### Budget Settings (AsyncStorage)
- `monthlyBudget` — Monthly spending limit
- `budgetResetDay` — Day of month budget resets (1-28)
- `budgetMode` — `'dynamic'` or `'fixed'`

## 📱 SMS Parsing

Supported bank patterns include HDFC, ICICI, SBI, Axis, UPI, and more. To add new patterns, edit `utils/smsParser.ts` and add regex entries to `BANK_PATTERNS`.

## 🔧 Development Setup

### Prerequisites
- Node.js 18+ · Java JDK 17+ · Android Studio (SDK 34+)

### Installation
```bash
git clone https://github.com/yourusername/spense.git
cd spense
npm install
npx expo start           # Dev server
npx expo run:android     # Run on device
```

### Building Release APK
```bash
npx expo export -p android -c
cd android && ./gradlew assembleRelease --no-daemon
# Output: android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

## 🔐 Permissions

| Permission | Purpose |
|------------|---------|
| `READ_SMS` | Read bank transaction messages |
| `RECEIVE_SMS` | Real-time SMS notifications |
| `FOREGROUND_SERVICE` | Background sync service |

## 🎨 Material You Icon

To make the app icon compatible with Material You themed icons:

1. Create a **monochrome** (white on transparent) version of your icon
2. Add `<monochrome>` element to `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
3. In `app.json`, add `monochromeImage` under `android.adaptiveIcon`

Tools: [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) or Android Studio → File → New → Image Asset

## 📊 Budget Modes

| Mode | Description |
|------|-------------|
| **Dynamic** | Daily limit = remaining budget ÷ remaining days |
| **Fixed** | Daily limit = monthly budget ÷ 30 |

## 🤝 Contributing

1. Fork → 2. Feature branch → 3. Commit → 4. Push → 5. PR

### Code Style
- TypeScript for all JS/TS · NativeWind for styling · Small focused components

---

**Made with ❤️ for financial privacy**
