# Priva - Private Expense Tracker

**Priva** is a privacy-focused expense tracking app that automatically reads bank SMS messages to track your spending. All data is processed locally on your device - nothing is uploaded to any server.

## 📱 Features

- **Automatic SMS Parsing**: Reads bank SMS messages and extracts transaction details
- **Smart Categorization**: AI-powered transaction categorization
- **Budget Tracking**: Set monthly budgets with dynamic or fixed daily limits
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
priva/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── _layout.tsx           # Tab layout configuration
│   │   ├── index.tsx             # Home screen (budget overview)
│   │   ├── transactions.tsx      # Full transaction list
│   │   └── analysis.tsx          # Spending analysis
│   ├── add.tsx                   # Add transaction manually
│   ├── edit-transaction.tsx      # Edit existing transaction
│   ├── onboarding.tsx            # First-time setup wizard
│   ├── settings.tsx              # App settings
│   └── _layout.tsx               # Root layout
├── components/                   # Reusable UI components
│   └── TransactionList.tsx       # Transaction list with actions
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
│   ├── notificationService.ts    # Push notifications
│   └── smsReader.ts              # SMS reading logic
├── utils/                        # Utilities
│   ├── smsParser.ts              # Bank SMS parsing patterns
│   └── transactionProcessor.ts   # Transaction intelligence
├── android/                      # Native Android code
│   └── app/src/main/java/com/priva/expense/
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
  category TEXT,
  description TEXT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'expense' | 'income'
  source TEXT,                  -- 'manual' | 'sms'
  transactionClass TEXT,        -- 'essential' | 'discretionary' | 'savings'
  rawSmsHash TEXT,              -- Hash of raw SMS for deduplication
  account TEXT,
  isIgnored INTEGER DEFAULT 0,
  createdAt TEXT
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT
);
```

### Budget Settings
Stored in AsyncStorage:
- `monthlyBudget`: Monthly spending limit
- `budgetResetDay`: Day of month budget resets (1-28)
- `budgetMode`: 'dynamic' or 'fixed'

## 📱 SMS Parsing

The app parses bank SMS messages using pattern matching. Supported patterns include:

| Bank | Pattern Examples |
|------|------------------|
| HDFC | `Rs.XXX debited from a/c` |
| ICICI | `INR XXX debited from Ac` |
| SBI | `Rs.XXX deducted from A/c` |
| Axis | `Rs.XXX has been debited` |
| UPI | `paid Rs.XXX to` |

Adding new bank patterns:
1. Edit `utils/smsParser.ts`
2. Add regex patterns to `BANK_PATTERNS` array
3. Include amount, merchant, and transaction type capture groups

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- Java JDK 17+
- Android Studio with SDK 34+
- Expo CLI (`npm install -g expo-cli`)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/priva.git
cd priva

# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android device
npx expo run:android
```

### Building Release APK

```bash
# Export JS bundle
npx expo export -p android -c

# Build APK
cd android
./gradlew assembleRelease --no-daemon

# APK location
# android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

### Signing Configuration

For production releases, create a keystore:

```bash
keytool -genkey -v -keystore keystore.jks -alias priva -keyalg RSA -keysize 2048 -validity 10000
```

Then add to `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=priva
MYAPP_UPLOAD_STORE_PASSWORD=your_password
MYAPP_UPLOAD_KEY_PASSWORD=your_password
```

## 🔐 Permissions

| Permission | Purpose |
|------------|---------|
| `READ_SMS` | Read bank transaction messages |
| `RECEIVE_SMS` | Real-time SMS notifications |
| `FOREGROUND_SERVICE` | Background sync service |
| `INTERNET` | (Future) Cloud backup |

## 🎨 Theming

Themes are managed via `ThemeContext.tsx`:

```typescript
const { theme, toggleTheme, autoTheme, setAutoTheme } = useTheme();
```

Colors follow system preference when `autoTheme` is enabled.

## 📊 Budget Modes

| Mode | Description |
|------|-------------|
| **Dynamic** | Daily limit = remaining budget ÷ remaining days |
| **Fixed** | Daily limit = monthly budget ÷ 30 |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all JS/TS files
- Follow React Native best practices
- Use NativeWind classes for styling
- Keep components small and focused

### Adding New Features

1. **New Screen**: Create in `app/` directory
2. **New Component**: Add to `components/`
3. **New Service**: Add to `services/`
4. **Database Changes**: Update `db/schema.ts` and run migration

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For issues or feature requests, please open a GitHub issue.

---

**Made with ❤️ for financial privacy**
