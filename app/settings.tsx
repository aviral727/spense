import { View, Text, TouchableOpacity, Alert, ScrollView, Switch, PermissionsAndroid, Platform, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import {
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    getInstallationTimestamp,
    getLastSyncTimestamp
} from '../services/autoSync';
import { getBudgetSettings, updateBudgetSettings } from '../services/budgetService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Settings() {
    const router = useRouter();
    const themeContext = useTheme();
    const { currency, setCurrency } = useCurrency();
    const [autoSync, setAutoSync] = useState(false);
    const [installDate, setInstallDate] = useState<string>('');
    const [lastSync, setLastSync] = useState<string>('Never');
    const [budgetLimit, setBudgetLimit] = useState('');
    const [startDay, setStartDay] = useState('');
    const [budgetMode, setBudgetMode] = useState<'dynamic' | 'fixed'>('dynamic');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const enabled = await isAutoSyncEnabled();
            setAutoSync(enabled);

            const budgetConfig = await getBudgetSettings();
            setBudgetLimit(budgetConfig.monthlyLimit > 0 ? budgetConfig.monthlyLimit.toString() : '');
            setStartDay(budgetConfig.startDay.toString());
            setBudgetMode(budgetConfig.budgetMode);

            const installTs = await getInstallationTimestamp();
            if (installTs) {
                setInstallDate(new Date(installTs).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }));
            }

            const lastSyncTs = await getLastSyncTimestamp();
            if (lastSyncTs) {
                setLastSync(new Date(lastSyncTs).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const requestSmsPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return false;

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
    };

    const handleSaveBudget = async () => {
        try {
            const limit = parseFloat(budgetLimit);
            const day = parseInt(startDay);

            if (isNaN(limit) || limit < 0) {
                Alert.alert('Invalid Limit', 'Please enter a valid monthly budget amount.');
                return;
            }
            if (isNaN(day) || day < 1 || day > 31) {
                Alert.alert('Invalid Day', 'Start day must be between 1 and 31.');
                return;
            }

            await updateBudgetSettings(limit, day, budgetMode);
            Alert.alert('Success', 'Budget settings updated!');
        } catch (error) {
            console.error('Error saving budget:', error);
            Alert.alert('Error', 'Failed to save budget settings.');
        }
    };

    const handleAutoSyncToggle = async (value: boolean) => {
        try {
            if (value) {
                // Request permissions first
                const hasPermission = await requestSmsPermissions();
                if (!hasPermission) {
                    Alert.alert(
                        'Permission Required',
                        'SMS permissions are required for auto-sync. Please grant the permissions and try again.',
                        [{ text: 'OK' }]
                    );
                    return; // Don't enable if permission not granted
                }
            }

            setAutoSync(value);
            await setAutoSyncEnabled(value);

            if (value) {
                Alert.alert('Auto-Sync Enabled', 'Transactions from SMS will be automatically captured.');
            } else {
                Alert.alert('Auto-Sync Disabled', 'Automatic SMS tracking has been turned off.');
            }
        } catch (error) {
            console.error('Error toggling auto-sync:', error);
            setAutoSync(!value); // Revert on error
        }
    };

    const handleResetData = () => {
        Alert.alert(
            "Reset All Data",
            "Are you sure you want to delete all transactions? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await db.delete(transactions);
                            Alert.alert("Success", "All data has been reset.");
                            router.replace('/');
                        } catch (error) {
                            console.error("Error resetting data:", error);
                            Alert.alert("Error", "Failed to delete data.");
                        }
                    }
                }
            ]
        );
    };

    const handleResetOnboarding = () => {
        Alert.alert(
            "Reset Setup",
            "This will take you back to the initial setup screen. Your data will not be deleted.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset Setup",
                    style: "default",
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem('onboarding_completed');
                            Alert.alert("Success", "Please restart the app to see the setup screen.");
                        } catch (error) {
                            console.error("Error resetting onboarding:", error);
                            Alert.alert("Error", "Failed to reset setup.");
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={themeContext.theme === 'dark' ? 'light' : 'dark'} />
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center p-6 border-b border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-900">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Text className="text-emerald-600 dark:text-emerald-400 text-lg">← Back</Text>
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">Settings</Text>
                </View>

                <ScrollView className="flex-1 p-6">
                    {/* Currency Settings */}
                    <View className="mb-6">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-3 uppercase tracking-wider ml-1">
                            Currency
                        </Text>
                        <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex-row justify-between items-center">
                            <Text className="text-gray-900 dark:text-white font-medium">Active Symbol</Text>
                            <View className="flex-row">
                                {['₹', '$', '€', '£', '¥'].map((symbol) => (
                                    <TouchableOpacity
                                        key={symbol}
                                        onPress={() => setCurrency(symbol)}
                                        className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${currency === symbol ? 'bg-emerald-600' : 'bg-gray-100 dark:bg-gray-800'}`}
                                    >
                                        <Text className={`font-bold ${currency === symbol ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {symbol}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Appearance Settings */}
                    <View className="mb-6">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-3 uppercase tracking-wider ml-1">
                            Appearance
                        </Text>
                        <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                            <View className="p-4 flex-row justify-between items-center border-b border-gray-100 dark:border-gray-800">
                                <View className="flex-1">
                                    <Text className="text-gray-900 dark:text-white font-medium">Follow System Theme</Text>
                                    <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                        Automatically switch between light and dark mode
                                    </Text>
                                </View>
                                <Switch
                                    value={themeContext.autoTheme}
                                    onValueChange={themeContext.setAutoTheme}
                                    trackColor={{ false: '#d1d5db', true: '#10b981' }}
                                    thumbColor={themeContext.autoTheme ? '#059669' : '#f3f4f6'}
                                />
                            </View>

                            {!themeContext.autoTheme && (
                                <View className="p-4 flex-row justify-between items-center">
                                    <Text className="text-gray-900 dark:text-white font-medium">Current Theme</Text>
                                    <TouchableOpacity
                                        onPress={themeContext.toggleTheme}
                                        className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl flex-row items-center gap-2"
                                    >
                                        <Text className="text-lg">{themeContext.theme === 'dark' ? '🌙' : '☀️'}</Text>
                                        <Text className="text-gray-900 dark:text-white font-semibold">
                                            {themeContext.theme === 'dark' ? 'Dark' : 'Light'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Budget Configuration */}
                    <View className="mb-6">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-3 uppercase tracking-wider ml-1">
                            Budget Configuration
                        </Text>
                        <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            {/* Mode Toggle */}
                            <View className="mb-6">
                                <Text className="text-gray-900 dark:text-white font-medium mb-3">Calculation Mode</Text>
                                <View className="flex-row bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                    <TouchableOpacity
                                        onPress={() => setBudgetMode('dynamic')}
                                        className={`flex-1 py-2 rounded-lg items-center ${budgetMode === 'dynamic' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                                    >
                                        <Text className={`font-semibold ${budgetMode === 'dynamic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>Dynamic</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setBudgetMode('fixed')}
                                        className={`flex-1 py-2 rounded-lg items-center ${budgetMode === 'fixed' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                                    >
                                        <Text className={`font-semibold ${budgetMode === 'fixed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>Fixed</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text className="text-gray-500 dark:text-gray-400 text-xs mt-2 ml-1">
                                    {budgetMode === 'dynamic'
                                        ? "Smooths spending. Unused budget rolls over to tomorrow."
                                        : "Strict daily limit. Overspending today reduces today's balance only."}
                                </Text>
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-900 dark:text-white font-medium mb-2">Monthly Limit ({currency})</Text>
                                <TextInput
                                    value={budgetLimit}
                                    onChangeText={setBudgetLimit}
                                    keyboardType="numeric"
                                    placeholder="e.g. 30000"
                                    placeholderTextColor="#9ca3af"
                                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-gray-900 dark:text-white font-bold"
                                />
                            </View>
                            <View className="mb-4">
                                <Text className="text-gray-900 dark:text-white font-medium mb-2">Budget Reset Date (Day of Month)</Text>
                                <TextInput
                                    value={startDay}
                                    onChangeText={setStartDay}
                                    keyboardType="numeric"
                                    placeholder="e.g. 1 or 25"
                                    placeholderTextColor="#9ca3af"
                                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-gray-900 dark:text-white font-bold"
                                />
                                <Text className="text-gray-500 dark:text-gray-400 text-xs mt-2 ml-1">
                                    Your spending tracker will reset to 0 on this day every month.
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleSaveBudget}
                                className="bg-emerald-600 p-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold">Save Budget Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Auto-Sync Section */}
                    <Text className="text-gray-500 font-bold uppercase tracking-wider mb-4 mt-2">
                        Automatic Tracking
                    </Text>

                    <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
                        <View className="p-5 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4 flex-1">
                                <View className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">🔄</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Auto-Sync SMS
                                    </Text>
                                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                                        Capture transactions automatically
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={autoSync}
                                onValueChange={handleAutoSyncToggle}
                                trackColor={{ false: '#767577', true: '#10b981' }}
                                thumbColor={autoSync ? '#ffffff' : '#f4f3f4'}
                            />
                        </View>

                        {autoSync && (
                            <View className="px-5 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
                                <View className="flex-row justify-between mt-3">
                                    <Text className="text-gray-500 dark:text-gray-400 text-sm">Tracking since</Text>
                                    <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">{installDate}</Text>
                                </View>
                                <View className="flex-row justify-between mt-2">
                                    <Text className="text-gray-500 dark:text-gray-400 text-sm">Last synced</Text>
                                    <Text className="text-gray-700 dark:text-gray-300 text-sm font-medium">{lastSync}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Features */}
                    <Text className="text-gray-500 font-bold uppercase tracking-wider mb-4 mt-6">
                        Import
                    </Text>

                    <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 mb-8">
                        <TouchableOpacity
                            onPress={() => router.push('/auto-import')}
                            className="p-5 flex-row items-center justify-between active:bg-gray-50 dark:active:bg-gray-800"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">📱</Text>
                                </View>
                                <View>
                                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">Manual Import</Text>
                                    <Text className="text-sm text-gray-500 dark:text-gray-400">Scan SMS for past transactions</Text>
                                </View>
                            </View>
                            <Text className="text-gray-300 dark:text-gray-600">›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Danger Zone */}
                    <Text className="text-red-500 font-bold uppercase tracking-wider mb-4 mt-4">Danger Zone</Text>

                    <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-red-100 dark:border-red-900/30">
                        <TouchableOpacity
                            onPress={handleResetOnboarding}
                            className="p-5 flex-row items-center justify-between active:bg-yellow-50 dark:active:bg-yellow-900/10 border-b border-gray-100 dark:border-gray-800"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">🔄</Text>
                                </View>
                                <View>
                                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">Reset Setup</Text>
                                    <Text className="text-sm text-gray-500 dark:text-gray-400">Go back to initial setup screen</Text>
                                </View>
                            </View>
                            <Text className="text-gray-300 dark:text-gray-600">›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleResetData}
                            className="p-5 flex-row items-center justify-between active:bg-red-50 dark:active:bg-red-900/10"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">🗑️</Text>
                                </View>
                                <View>
                                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">Reset Data</Text>
                                    <Text className="text-sm text-gray-500 dark:text-gray-400">Delete all transactions permanently</Text>
                                </View>
                            </View>
                            <Text className="text-gray-300 dark:text-gray-600">›</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-center text-gray-400 dark:text-gray-600 mt-12 text-sm">
                        Spense v1.0.0
                    </Text>
                </ScrollView>
            </View >
        </SafeAreaView >
    );
}
