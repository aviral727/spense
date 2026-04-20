import { View, Text, TouchableOpacity, Alert, ScrollView, Switch, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { getBudgetSettings, updateBudgetSettings } from '../services/budgetService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Settings() {
    const router = useRouter();
    const themeContext = useTheme();
    const { currency, setCurrency } = useCurrency();
    const [budgetLimit, setBudgetLimit] = useState('');
    const [startDay, setStartDay] = useState('');
    const [budgetMode, setBudgetMode] = useState<'dynamic' | 'fixed'>('dynamic');

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const budgetConfig = await getBudgetSettings();
            setBudgetLimit(budgetConfig.monthlyLimit > 0 ? budgetConfig.monthlyLimit.toString() : '');
            setStartDay(budgetConfig.startDay.toString());
            setBudgetMode(budgetConfig.budgetMode);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const handleSaveBudget = async () => {
        const limit = parseFloat(budgetLimit);
        const day = parseInt(startDay);
        if (isNaN(limit) || limit < 0) { Alert.alert('Invalid Limit', 'Please enter a valid monthly budget amount.'); return; }
        if (isNaN(day) || day < 1 || day > 31) { Alert.alert('Invalid Day', 'Start day must be between 1 and 31.'); return; }
        try {
            await updateBudgetSettings(limit, day, budgetMode);
            Alert.alert('Saved ✓', 'Budget settings updated!');
        } catch (error) {
            Alert.alert('Error', 'Failed to save budget settings.');
        }
    };

    const handleResetData = () => {
        Alert.alert(
            "Reset All Data",
            "Are you sure you want to delete all transactions? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await db.delete(transactions);
                            Alert.alert("Done", "All transactions deleted.");
                            router.replace('/');
                        } catch { Alert.alert("Error", "Failed to delete data."); }
                    }
                }
            ]
        );
    };

    const handleResetOnboarding = () => {
        Alert.alert(
            "Reset Setup",
            "Goes back to the setup wizard. Your data will NOT be deleted.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset Setup",
                    onPress: async () => {
                        await AsyncStorage.removeItem('onboarding_completed');
                        Alert.alert("Done", "Restart the app to see the setup screen.");
                    }
                }
            ]
        );
    };

    const cardClass = "bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700";
    const sectionLabel = "text-slate-400 dark:text-slate-500 text-xs font-semibold mb-3 uppercase tracking-widest ml-1";

    return (
        <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
            <StatusBar style={themeContext.theme === 'dark' ? 'light' : 'dark'} />
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Text className="text-emerald-600 dark:text-emerald-400 text-lg">← Back</Text>
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-slate-900 dark:text-white">Settings</Text>
                </View>

                <ScrollView className="flex-1 p-6">

                    {/* ── Currency ─────────────────────────── */}
                    <View className="mb-6">
                        <Text className={sectionLabel}>Currency</Text>
                        <View className={`${cardClass} p-4 flex-row justify-between items-center`}>
                            <Text className="text-slate-900 dark:text-white font-medium">Active Symbol</Text>
                            <View className="flex-row">
                                {['₹', '$', '€', '£', '¥'].map((symbol) => (
                                    <TouchableOpacity
                                        key={symbol}
                                        onPress={() => setCurrency(symbol)}
                                        className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${currency === symbol ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-700'}`}
                                    >
                                        <Text className={`font-bold ${currency === symbol ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{symbol}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* ── Appearance ───────────────────────── */}
                    <View className="mb-6">
                        <Text className={sectionLabel}>Appearance</Text>
                        <View className={cardClass}>
                            <View className="p-4 flex-row justify-between items-center border-b border-slate-100 dark:border-slate-700">
                                <View className="flex-1">
                                    <Text className="text-slate-900 dark:text-white font-medium">Follow System Theme</Text>
                                    <Text className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Auto switch light / dark</Text>
                                </View>
                                <Switch
                                    value={themeContext.autoTheme}
                                    onValueChange={themeContext.setAutoTheme}
                                    trackColor={{ false: '#475569', true: '#10b981' }}
                                    thumbColor={themeContext.autoTheme ? '#059669' : '#f1f5f9'}
                                />
                            </View>
                            {!themeContext.autoTheme && (
                                <View className="p-4 flex-row justify-between items-center">
                                    <Text className="text-slate-900 dark:text-white font-medium">Current Theme</Text>
                                    <TouchableOpacity
                                        onPress={themeContext.toggleTheme}
                                        className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl flex-row items-center gap-2"
                                    >
                                        <Text className="text-lg">{themeContext.theme === 'dark' ? '🌙' : '☀️'}</Text>
                                        <Text className="text-slate-900 dark:text-white font-semibold">
                                            {themeContext.theme === 'dark' ? 'Dark' : 'Light'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── Budget Configuration ─────────────── */}
                    <View className="mb-6">
                        <Text className={sectionLabel}>Budget Configuration</Text>
                        <View className={`${cardClass} p-4`}>
                            {/* Mode Picker */}
                            <Text className="text-slate-900 dark:text-white font-medium mb-3">Calculation Mode</Text>
                            <View className="flex-row bg-slate-100 dark:bg-slate-700 p-1 rounded-xl mb-2">
                                {(['dynamic', 'fixed'] as const).map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        onPress={() => setBudgetMode(mode)}
                                        className={`flex-1 py-2 rounded-lg items-center ${budgetMode === mode ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}
                                    >
                                        <Text className={`font-semibold capitalize ${budgetMode === mode ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                            {mode}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text className="text-slate-500 dark:text-slate-400 text-xs mb-5 ml-1">
                                {budgetMode === 'dynamic'
                                    ? "Unused budget rolls over day-to-day."
                                    : "Same strict daily limit every day."}
                            </Text>

                            {/* Monthly Limit */}
                            <Text className="text-slate-900 dark:text-white font-medium mb-2">Monthly Limit ({currency})</Text>
                            <TextInput
                                value={budgetLimit}
                                onChangeText={setBudgetLimit}
                                keyboardType="numeric"
                                placeholder="e.g. 30000"
                                placeholderTextColor="#64748b"
                                className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-slate-900 dark:text-white font-bold mb-4"
                            />

                            {/* Reset Day */}
                            <Text className="text-slate-900 dark:text-white font-medium mb-2">Budget Reset Date (Day of Month)</Text>
                            <TextInput
                                value={startDay}
                                onChangeText={setStartDay}
                                keyboardType="numeric"
                                placeholder="e.g. 1 or 25"
                                placeholderTextColor="#64748b"
                                className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-slate-900 dark:text-white font-bold mb-1"
                            />
                            <Text className="text-slate-400 text-xs mb-4 ml-1">Spending tracker resets to 0 on this day every month.</Text>

                            <TouchableOpacity onPress={handleSaveBudget} className="bg-emerald-600 p-3 rounded-xl items-center">
                                <Text className="text-white font-bold">Save Budget Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── Danger Zone ──────────────────────── */}
                    <Text className="text-red-500 text-xs font-semibold uppercase tracking-widest mb-3 mt-2 ml-1">Danger Zone</Text>
                    <View className={`${cardClass} border-red-100 dark:border-red-900/30`}>
                        <TouchableOpacity
                            onPress={handleResetOnboarding}
                            className="p-5 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-700"
                        >
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">🔄</Text>
                                </View>
                                <View>
                                    <Text className="text-base font-semibold text-slate-900 dark:text-white">Reset Setup</Text>
                                    <Text className="text-sm text-slate-500 dark:text-slate-400">Go back to initial setup</Text>
                                </View>
                            </View>
                            <Text className="text-slate-300 dark:text-slate-600">›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleResetData} className="p-5 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                                    <Text className="text-lg">🗑️</Text>
                                </View>
                                <View>
                                    <Text className="text-base font-semibold text-slate-900 dark:text-white">Reset Data</Text>
                                    <Text className="text-sm text-slate-500 dark:text-slate-400">Delete all transactions permanently</Text>
                                </View>
                            </View>
                            <Text className="text-slate-300 dark:text-slate-600">›</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-center text-slate-400 dark:text-slate-600 mt-12 mb-4 text-sm">SpenseTrack v1.1.0</Text>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
