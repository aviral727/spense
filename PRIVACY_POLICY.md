# Privacy Policy for Spense

**Effective Date:** March 4, 2026

Spense ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use the Spense mobile application (the "App").

## 1. 100% On-Device Processing
Spense is designed with a "privacy-first" philosophy. **We do not collect, transmit, store, or process any of your personal or financial data on external servers.** 

All operations, including SMS parsing, transaction categorization, and budget calculations, are performed strictly **on your device**. The App does not require an internet connection to function as intended, and no cloud backups or sync services are used to transfer your data externally.

## 2. Permissions We Request
To provide automated expense tracking, Spense requires specific device permissions. These permissions are used exclusively for on-device operations:

*   **READ_SMS & RECEIVE_SMS:** Required to read bank and transaction messages. The App parses these messages locally to extract transaction amounts, categories, and merchant names. Your messages are never uploaded, sent to us, or shared with any third party.
*   **FOREGROUND_SERVICE & FOREGROUND_SERVICE_DATA_SYNC:** Used to maintain a background listener so the App can reliably detect and record new SMS transactions even when it is not actively open.
*   **NOTIFICATIONS:** Used to alert you about new transactions and budget thresholds.

## 3. Data Storage
All transaction records, parsed SMS data, budget configurations, and categories are stored locally in an SQLite database on your mobile device. If you uninstall the App or clear its data, all your transaction history will be permanently deleted unless you have made a manual, external backup of your device.

## 4. Third-Party Services
Spense does not integrate with any third-party analytics, tracking, advertising, or crash reporting services that collect user data. The App is entirely self-contained.

## 5. Security
Because your data never leaves your device, the security of your financial information relies entirely on the security of your device itself. We recommend using a strong screen lock, keeping your device's operating system up to date, and exercising caution when granting access to your device. 

## 6. Children's Privacy
Spense does not knowingly collect personally identifiable information from anyone. As the app operates entirely offline and collects no data, it poses no privacy risks to children under 13.

## 7. Changes to This Privacy Policy
We may update our Privacy Policy from time to time. Since the App does not connect to the internet, you will be notified of any changes to this Privacy Policy through updates to the App version on the Google Play Store (or the platform from which you downloaded it) or via the repository where the App is hosted.

## 8. Contact Us
If you have any questions or suggestions about this Privacy Policy, please contact the developer via the official GitHub repository:
[https://github.com/aviral727/spense](https://github.com/aviral727/spense)
