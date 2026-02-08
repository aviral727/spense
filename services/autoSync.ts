import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { parseSMSTransaction, isTransactionSMS } from '../utils/smsParser';
import { processTransactions, generateSmsHash } from '../utils/transactionProcessor';

const { SmsListenerModule, BackgroundSyncModule } = NativeModules;

// Storage keys
const STORAGE_KEYS = {
    AUTO_SYNC_ENABLED: 'autoSyncEnabled',
    LAST_SYNC_TIMESTAMP: 'lastSyncTimestamp',
    INSTALLATION_TIMESTAMP: 'installationTimestamp',
};

interface SmsEvent {
    sender: string;
    body: string;
    timestamp: number;
}

let smsEventEmitter: NativeEventEmitter | null = null;
let smsSubscription: any = null;

/**
 * Initialize the SMS listener (call on app launch)
 */
export async function initializeSmsListener(): Promise<void> {
    if (Platform.OS !== 'android') {
        console.log('SMS listener only available on Android');
        return;
    }

    // Set installation timestamp if first launch
    const installTimestamp = await AsyncStorage.getItem(STORAGE_KEYS.INSTALLATION_TIMESTAMP);
    if (!installTimestamp) {
        await AsyncStorage.setItem(STORAGE_KEYS.INSTALLATION_TIMESTAMP, Date.now().toString());
        console.log('📅 First launch - set installation timestamp');
    }

    // Check if auto-sync is enabled
    const autoSyncEnabled = await isAutoSyncEnabled();
    if (autoSyncEnabled) {
        await startListening();
        // Sync any missed SMS since last launch
        await syncMissedSMS();
    }
}

/**
 * Start listening for incoming SMS
 */
export async function startListening(): Promise<void> {
    if (Platform.OS !== 'android') {
        console.log('SMS listener only available on Android');
        return;
    }

    // Request permissions first (works without native module)
    const hasPermission = await requestSmsPermissions();
    if (!hasPermission) {
        console.log('❌ SMS permissions not granted');
        return;
    }
    console.log('✅ SMS permissions granted');

    // Check if native module is available
    if (!SmsListenerModule) {
        console.log('⚠️ SmsListenerModule not available - rebuild required with: npx expo run:android');
        return;
    }

    try {
        // Start native listener
        await SmsListenerModule.startListening();

        // Set up event listener
        if (!smsEventEmitter) {
            smsEventEmitter = new NativeEventEmitter(SmsListenerModule);
        }

        // Remove old subscription if exists
        if (smsSubscription) {
            smsSubscription.remove();
        }

        // Subscribe to SMS events
        smsSubscription = smsEventEmitter.addListener('onSmsReceived', handleIncomingSms);

        console.log('📱 SMS listener started');

        // Start background service for real-time sync when app is closed
        if (BackgroundSyncModule) {
            try {
                await BackgroundSyncModule.startBackgroundSync();
                console.log('🔄 Background sync service started');
            } catch (error) {
                console.log('⚠️ Could not start background service:', error);
            }
        }
    } catch (error) {
        console.error('Error starting SMS listener:', error);
    }
}

/**
 * Stop listening for SMS
 */
export async function stopListening(): Promise<void> {
    if (Platform.OS !== 'android' || !SmsListenerModule) return;

    try {
        if (smsSubscription) {
            smsSubscription.remove();
            smsSubscription = null;
        }
        await SmsListenerModule.stopListening();
        console.log('📱 SMS listener stopped');

        // Stop background service
        if (BackgroundSyncModule) {
            try {
                await BackgroundSyncModule.stopBackgroundSync();
                console.log('🔄 Background sync service stopped');
            } catch (error) {
                console.log('⚠️ Could not stop background service:', error);
            }
        }
    } catch (error) {
        console.error('Error stopping SMS listener:', error);
    }
}

/**
 * Handle incoming SMS event
 */
async function handleIncomingSms(event: SmsEvent): Promise<void> {
    console.log('📨 SMS received:', event.sender);

    try {
        // Check if it's a transaction SMS
        if (!isTransactionSMS(event.sender, event.body)) {
            console.log('Not a transaction SMS, ignoring');
            return;
        }

        // Parse the SMS
        const parsed = parseSMSTransaction(event.body, event.timestamp);
        if (!parsed) {
            console.log('Could not parse SMS');
            return;
        }

        // Process through intelligence engine
        const [processed] = processTransactions([parsed]);
        if (!processed) {
            console.log('Transaction filtered out by intelligence engine');
            return;
        }

        // STRICT FILTER: Only allow expenses (Debits)
        if (processed.type === 'income') {
            console.log('🚫 Ignoring income transaction (User Preference)');
            return;
        }

        // Check for duplicates
        const existingTxns = await db.select().from(transactions);
        const existingHashes = new Set(existingTxns.map((t: any) => t.rawSmsHash).filter(Boolean));

        if (existingHashes.has(processed.rawSmsHash)) {
            console.log('Duplicate SMS, ignoring');
            return;
        }

        // Insert into database
        const result = await db.insert(transactions).values({
            amount: processed.amount,
            category: processed.category || 'Others',
            description: processed.merchant,
            date: processed.date,
            type: processed.type,
            source: 'sms',
            transactionClass: processed.transactionClass,
            rawSmsHash: processed.rawSmsHash,
            account: processed.account,
        }).returning({ id: transactions.id });

        const newTxId = result[0]?.id;

        console.log(`✅ Auto-imported: ₹${processed.amount} (${processed.transactionClass})`);

        // Check alerts for expense SMS
        if (processed.type === 'expense') {
            // Dynamic import to avoid cycles if any, though service import is fine
            const { checkBudgetAlerts } = require('./notificationService');
            await checkBudgetAlerts(processed.amount, newTxId);
        }

        // Update last sync timestamp
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, Date.now().toString());

    } catch (error) {
        console.error('Error processing incoming SMS:', error);
    }
}

/**
 * Sync SMS messages that were received while the app was closed
 */
async function syncMissedSMS(): Promise<void> {
    try {
        const lastSyncTimestamp = await getLastSyncTimestamp();
        const installTimestamp = await getInstallationTimestamp();

        // Use last sync time, or installation time if never synced
        const startTime = lastSyncTimestamp || installTimestamp || (Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago

        console.log(`🔄 Syncing missed SMS since ${new Date(startTime).toLocaleString()}`);

        // Import the SMS reader
        const { readSMSMessages } = require('./smsReader');

        // Read SMS since last sync
        const parsedTransactions = await readSMSMessages({ startDate: startTime });

        if (parsedTransactions.length === 0) {
            console.log('No new SMS transactions found');
            return;
        }

        console.log(`Found ${parsedTransactions.length} potential transactions`);

        // Process through intelligence engine
        const processedTransactions = processTransactions(parsedTransactions);

        // Filter to only expenses (debits)
        const expenses = processedTransactions.filter(tx => tx.type === 'expense');

        console.log(`Processing ${expenses.length} expense transactions`);

        // Get existing transaction hashes to avoid duplicates
        const existingTxns = await db.select().from(transactions);
        const existingHashes = new Set(existingTxns.map((t: any) => t.rawSmsHash).filter(Boolean));

        let importedCount = 0;

        for (const tx of expenses) {
            const hash = generateSmsHash(tx.rawMessage || '');

            // Skip if already imported
            if (existingHashes.has(hash)) {
                continue;
            }

            try {
                // Insert transaction
                const result = await db.insert(transactions).values({
                    amount: tx.amount,
                    category: tx.category || 'Others',
                    description: tx.merchant,
                    date: tx.date,
                    type: tx.type,
                    source: 'sms',
                    transactionClass: tx.transactionClass,
                    rawSmsHash: hash,
                    account: tx.account,
                }).returning({ id: transactions.id });

                const newTxId = result[0]?.id;

                // Send notification
                const { checkBudgetAlerts } = require('./notificationService');
                await checkBudgetAlerts(tx.amount, newTxId);

                importedCount++;
            } catch (error) {
                console.error(`Error importing transaction: ${error}`);
            }
        }

        console.log(`✅ Imported ${importedCount} missed transactions`);

        // Update last sync timestamp
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, Date.now().toString());

    } catch (error) {
        console.error('Error syncing missed SMS:', error);
    }
}

/**
 * Check if auto-sync is enabled
 */
export async function isAutoSyncEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
    return value === 'true';
}

/**
 * Set auto-sync enabled/disabled
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled.toString());

    if (enabled) {
        await startListening();
    } else {
        await stopListening();
    }
}

/**
 * Get installation timestamp
 */
export async function getInstallationTimestamp(): Promise<number | null> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.INSTALLATION_TIMESTAMP);
    return value ? parseInt(value, 10) : null;
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP);
    return value ? parseInt(value, 10) : null;
}

/**
 * Request SMS permissions
 */
async function requestSmsPermissions(): Promise<boolean> {
    try {
        const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        ]);

        return (
            results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
        );
    } catch (error) {
        console.error('Error requesting SMS permissions:', error);
        return false;
    }
}

/**
 * Import historical SMS messages (exported version of syncMissedSMS)
 * Called during onboarding when user chooses to import previous transactions
 */
export async function importHistoricalSms(): Promise<void> {
    console.log('📱 Starting historical SMS import...');
    return syncMissedSMS();
}
