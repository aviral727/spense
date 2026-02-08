import { View, Text, TouchableOpacity, FlatList, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { requestSMSPermission, checkSMSPermission, readSMSMessages } from '../services/smsReader';
import { deduplicateTransactions, ParsedTransaction } from '../utils/smsParser';
import { processTransactions, ProcessedTransaction, deduplicateByHash } from '../utils/transactionProcessor';
import { db } from '../db/client';
import { transactions } from '../db/schema';

export default function AutoImport() {
    const router = useRouter();
    const { theme } = useTheme();
    const { currency } = useCurrency();
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(false);
    const [detectedTransactions, setDetectedTransactions] = useState<ProcessedTransaction[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [importing, setImporting] = useState(false);
    const [importMode, setImportMode] = useState<'all' | 'date'>('all');
    const [dateInput, setDateInput] = useState('');

    useEffect(() => {
        checkPermissions();
        // Set default date to 1st of current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateInput(`${startOfMonth.getDate().toString().padStart(2, '0')}/${(startOfMonth.getMonth() + 1).toString().padStart(2, '0')}/${startOfMonth.getFullYear()}`);
    }, []);

    const checkPermissions = async () => {
        const granted = await checkSMSPermission();
        setHasPermission(granted);
    };

    const handleRequestPermission = async () => {
        try {
            const granted = await requestSMSPermission();
            setHasPermission(granted);

            if (granted) {
                // Don't auto-scan, let user choose mode first
            } else {
                // Check if we're in Expo Go
                const isExpoGo = !granted && !(await checkSMSPermission());

                Alert.alert(
                    'SMS Feature Unavailable',
                    'The SMS auto-import feature requires a development build and is not available in Expo Go.\n\nTo use this feature:\n1. Run: npx expo prebuild\n2. Run: npx expo run:android\n\nFor now, you can manually add transactions using the + button.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Permission error:', error);
            Alert.alert(
                'Error',
                'Unable to request SMS permission. This feature requires a development build.',
                [{ text: 'OK' }]
            );
        }
    };

    const parseDate = (dateStr: string): number | null => {
        try {
            const [day, month, year] = dateStr.split('/').map(num => parseInt(num, 10));
            if (!day || !month || !year) return null;
            const date = new Date(year, month - 1, day);
            return date.getTime();
        } catch (e) {
            return null;
        }
    };

    const scanSMS = async () => {
        setLoading(true);
        try {
            let options = {};

            if (importMode === 'all') {
                options = { daysBack: 3650 }; // 10 years
            } else {
                const timestamp = parseDate(dateInput);
                if (!timestamp) {
                    Alert.alert('Invalid Date', 'Please enter a valid date in DD/MM/YYYY format');
                    setLoading(false);
                    return;
                }
                options = { startDate: timestamp };
            }

            const smsTransactions = await readSMSMessages(options);

            // Apply Transaction Intelligence processing
            const processed = processTransactions(smsTransactions);
            console.log(`Processed ${processed.length} transactions (${processed.filter(t => t.transactionClass === 'transfer').length} transfers detected)`);

            // Get existing transactions to deduplicate
            const existing = await db.select().from(transactions);
            const existingHashes = new Set(existing.map((e: any) => e.rawSmsHash).filter(Boolean));

            // Deduplicate by hash first (more accurate), then by time/amount
            let deduplicated = deduplicateByHash(processed, existingHashes);
            deduplicated = deduplicated.filter(tx =>
                !existing.some((e: any) =>
                    Math.abs(e.amount - tx.amount) < 1.0 &&
                    e.type === tx.type &&
                    Math.abs(e.date - tx.date) < 5 * 60 * 1000
                )
            );

            setDetectedTransactions(deduplicated);

            // Auto-select all by default
            const allIds = new Set(deduplicated.map((_, index) => index));
            setSelectedIds(allIds);

            if (deduplicated.length === 0) {
                Alert.alert(
                    'No New Transactions',
                    'No new transactions were found based on your filter.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error scanning SMS:', error);
            Alert.alert(
                'Error',
                'Failed to scan SMS messages. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (index: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        const allIds = new Set(detectedTransactions.map((_, index) => index));
        setSelectedIds(allIds);
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) {
            Alert.alert('No Selection', 'Please select at least one transaction to import.');
            return;
        }

        setImporting(true);
        try {
            const toImport = detectedTransactions.filter((_, index) => selectedIds.has(index));

            for (const tx of toImport) {
                await db.insert(transactions).values({
                    amount: tx.amount,
                    category: tx.category || 'Other',
                    date: tx.date,
                    type: tx.type,
                    description: tx.merchant || null,
                    source: 'sms',
                    transactionClass: tx.transactionClass,
                    linkedTransactionId: tx.linkedTransactionId || null,
                    rawSmsHash: tx.rawSmsHash,
                    account: tx.account || null,
                });
            }

            Alert.alert(
                'Success',
                `Imported ${toImport.length} transaction(s) successfully!`,
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error) {
            console.error('Error importing transactions:', error);
            Alert.alert('Error', 'Failed to import transactions. Please try again.');
        } finally {
            setImporting(false);
        }
    };

    if (!hasPermission) {
        return (
            <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
                <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
                <View className="flex-1 p-6">
                    <TouchableOpacity onPress={() => router.back()} className="mb-6">
                        <Text className="text-emerald-600 dark:text-emerald-400 text-lg">← Back</Text>
                    </TouchableOpacity>

                    <View className="flex-1 items-center justify-center px-6">
                        <Text className="text-6xl mb-6">📱</Text>
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                            Auto-Import Transactions
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400 text-center mb-8">
                            Automatically detect and import transactions from your bank SMS messages.
                        </Text>

                        <View className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-2xl mb-8 w-full">
                            <Text className="text-sm text-gray-700 dark:text-gray-300 mb-2">✓ Detects bank & UPI transactions</Text>
                            <Text className="text-sm text-gray-700 dark:text-gray-300 mb-2">✓ Filter by date or scan all</Text>
                            <Text className="text-sm text-gray-700 dark:text-gray-300 mb-2">✓ Auto-categorizes expenses</Text>
                            <Text className="text-sm text-gray-700 dark:text-gray-300">✓ Review before importing</Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleRequestPermission}
                            className="bg-emerald-600 px-8 py-4 rounded-2xl w-full"
                        >
                            <Text className="text-white font-bold text-center text-lg">
                                Grant SMS Permission
                            </Text>
                        </TouchableOpacity>

                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                            We only read transaction SMS from banks and payment apps. Your messages remain private.
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <View className="flex-1">
                <View className="flex-row justify-between items-center p-6 pb-4">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-emerald-600 dark:text-emerald-400 text-lg">← Back</Text>
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">Auto Import</Text>
                    <View style={{ width: 60 }} />
                </View>

                {detectedTransactions.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-6">
                        {loading ? (
                            <>
                                <ActivityIndicator size="large" color="#059669" />
                                <Text className="text-gray-600 dark:text-gray-400 mt-4">Scanning SMS messages...</Text>
                            </>
                        ) : (
                            <>
                                <Text className="text-6xl mb-4">📨</Text>
                                <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Scan Options
                                </Text>

                                {/* Scan Options Toggle */}
                                <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-2xl p-1 mb-8 w-full">
                                    <TouchableOpacity
                                        onPress={() => setImportMode('all')}
                                        className="flex-1 py-3 rounded-xl"
                                        style={importMode === 'all' ? { backgroundColor: theme === 'dark' ? '#374151' : 'white', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}}
                                    >
                                        <Text className={`text-center font-bold ${importMode === 'all' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                            All Time
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setImportMode('date')}
                                        className="flex-1 py-3 rounded-xl"
                                        style={importMode === 'date' ? { backgroundColor: theme === 'dark' ? '#374151' : 'white', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}}
                                    >
                                        <Text className={`text-center font-bold ${importMode === 'date' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                            From Date
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {importMode === 'date' && (
                                    <View className="w-full mb-8">
                                        <Text className="text-gray-500 dark:text-gray-400 mb-2 ml-1 text-sm uppercase tracking-wider font-bold">Start Date (DD/MM/YYYY)</Text>
                                        <View className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
                                            <TextInput
                                                value={dateInput}
                                                onChangeText={(text) => {
                                                    console.log('Date input changed:', text);
                                                    setDateInput(text);
                                                }}
                                                placeholder="DD/MM/YYYY"
                                                placeholderTextColor="#9ca3af"
                                                keyboardType="numbers-and-punctuation"
                                                className="text-lg font-semibold text-gray-900 dark:text-white"
                                            />
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={scanSMS}
                                    className="bg-emerald-600 px-8 py-4 rounded-2xl w-full"
                                >
                                    <Text className="text-white font-bold text-center text-lg">
                                        {importMode === 'all' ? 'Scan All SMS' : `Scan from ${dateInput || 'Date'}`}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                ) : (
                    <>
                        <View className="px-6 pb-4 flex-row justify-between items-center">
                            <Text className="text-gray-600 dark:text-gray-400">
                                Found {detectedTransactions.length} • Selected {selectedIds.size}
                            </Text>
                            <View className="flex-row gap-4">
                                <TouchableOpacity onPress={selectAll}>
                                    <Text className="text-emerald-600 dark:text-emerald-400 font-semibold">Select All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={deselectAll}>
                                    <Text className="text-gray-400 dark:text-gray-500 font-semibold">Clear</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <FlatList
                            data={detectedTransactions}
                            keyExtractor={(_, index) => index.toString()}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                            renderItem={({ item, index }) => {
                                const isSelected = selectedIds.has(index);
                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleSelection(index)}
                                        className={`p-4 rounded-2xl mb-3 ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                                            }`}
                                    >
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View className="flex-1">
                                                <Text className="font-bold text-lg text-gray-900 dark:text-white">
                                                    {item.merchant || 'Unknown'}
                                                </Text>
                                                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {item.category} • {new Date(item.date).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            <Text className={`font-bold text-lg ${item.type === 'expense' ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                {item.type === 'expense' ? '-' : '+'}{currency}{item.amount.toFixed(2)}
                                            </Text>
                                        </View>
                                        <Text className="text-xs text-gray-400 mt-2" numberOfLines={2}>
                                            {item.rawMessage}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 p-6 border-t border-gray-200 dark:border-gray-800">
                            <TouchableOpacity
                                onPress={handleImport}
                                disabled={importing || selectedIds.size === 0}
                                className={`py-4 rounded-2xl ${importing || selectedIds.size === 0 ? 'bg-gray-300 dark:bg-gray-700' : 'bg-emerald-600'
                                    }`}
                            >
                                {importing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold text-center text-lg">
                                        Import {selectedIds.size} Transaction(s)
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}
