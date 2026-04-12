import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateBudgetSettings } from '../services/budgetService';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../db/client';
import { categories } from '../db/schema';
import { seedCategories } from '../db/seed';

const ONBOARDING_KEY = 'onboarding_completed';
const totalSteps = 5;

export default function OnboardingScreen() {
    const router = useRouter();
    const { currency, setCurrency } = useCurrency();
    const { theme } = useTheme();

    const [step, setStep] = useState(1);
    const [monthlyBudget, setMonthlyBudget] = useState('');
    const [resetDay, setResetDay] = useState('1');
    const [budgetMode, setBudgetMode] = useState<'dynamic' | 'fixed'>('dynamic');
    const [selectedCurrency, setSelectedCurrency] = useState('₹');
    const [isSaving, setIsSaving] = useState(false);

    const detectSystemSettings = () => {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        if (locale.includes('IN')) setSelectedCurrency('₹');
        else if (locale.includes('US')) setSelectedCurrency('$');
        else if (locale.includes('GB')) setSelectedCurrency('£');
        else if (locale.includes('EU') || locale.includes('DE') || locale.includes('FR')) setSelectedCurrency('€');
        else if (locale.includes('JP') || locale.includes('CN')) setSelectedCurrency('¥');
        setMonthlyBudget('30000');
        setResetDay('1');
        Alert.alert('Settings Detected', 'We\'ve suggested some settings based on your locale.');
    };

    const handleNext = async () => {
        if (step === 2 && !selectedCurrency) {
            Alert.alert('Required', 'Please select a currency'); return;
        }
        if (step === 3) {
            const budget = parseFloat(monthlyBudget);
            if (!monthlyBudget || isNaN(budget) || budget <= 0) {
                Alert.alert('Invalid Budget', 'Please enter a valid monthly budget'); return;
            }
        }
        if (step === 4) {
            const day = parseInt(resetDay);
            if (!resetDay || isNaN(day) || day < 1 || day > 28) {
                Alert.alert('Invalid Day', 'Please enter a day between 1 and 28'); return;
            }
        }

        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            await completeOnboarding();
        }
    };

    const completeOnboarding = async () => {
        try {
            setIsSaving(true);
            setCurrency(selectedCurrency);
            await updateBudgetSettings(parseFloat(monthlyBudget), parseInt(resetDay), budgetMode);
            await seedCategories();
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error completing onboarding:', error);
            Alert.alert('Error', 'Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Step Indicator ──────────────────────────────────────────────────────
    const renderStepIndicator = () => (
        <View className="flex-row justify-center mb-8 gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
                <View
                    key={i}
                    className={`h-2 rounded-full ${i === step ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-700'}`}
                />
            ))}
        </View>
    );

    // ── Step 1: Welcome ─────────────────────────────────────────────────────
    const renderWelcome = () => (
        <View className="flex-1 justify-center px-6">
            <View className="mb-8 items-center">
                <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                    Welcome to{'\n'}Spense 👋
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-center text-lg px-4 mt-2">
                    Your smart, privacy-first budget tracker. No accounts, no cloud — everything stays on your phone.
                </Text>
            </View>

            <View className="bg-white dark:bg-slate-800 rounded-3xl p-6 mb-6 shadow-lg">
                <View className="flex-row gap-4 mb-5">
                    <View className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">✍️</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-slate-900 dark:text-white font-bold text-lg mb-1">Manual Tracking</Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-sm leading-5">Quickly log expenses by tapping the + button — fast and always accurate.</Text>
                    </View>
                </View>
                <View className="flex-row gap-4 mb-5">
                    <View className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">🔒</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-slate-900 dark:text-white font-bold text-lg mb-1">100% Private</Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-sm leading-5">All data is stored locally. Nothing leaves your device.</Text>
                    </View>
                </View>
                <View className="flex-row gap-4">
                    <View className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">📊</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-slate-900 dark:text-white font-bold text-lg mb-1">Smart Budgets</Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-sm leading-5">Dynamic or fixed daily limits — see exactly how much is safe to spend today.</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    // ── Step 2: Currency ────────────────────────────────────────────────────
    const renderCurrency = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">Select Currency 💱</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center mb-8 text-lg">Choose your local currency for tracking</Text>

            <View className="bg-white dark:bg-slate-800 rounded-3xl p-6 mb-6 shadow-lg">
                <View className="flex-row flex-wrap gap-3">
                    {['₹', '$', '€', '£', '¥'].map((curr) => (
                        <TouchableOpacity
                            key={curr}
                            onPress={() => setSelectedCurrency(curr)}
                            className={`flex-1 min-w-[60px] h-16 rounded-2xl items-center justify-center ${selectedCurrency === curr ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-700'}`}
                        >
                            <Text className={`text-2xl font-bold ${selectedCurrency === curr ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                {curr}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity onPress={detectSystemSettings} className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl">
                <Text className="text-blue-600 dark:text-blue-400 text-center font-semibold">🤖 Auto-detect from system</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Step 3: Budget Amount ───────────────────────────────────────────────
    const renderBudget = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">Monthly Budget 💰</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center mb-8 text-lg">How much do you want to spend each month?</Text>

            <View className="bg-white dark:bg-slate-800 rounded-3xl p-8 mb-6 shadow-lg">
                <View className="flex-row items-center justify-center mb-4">
                    <Text className="text-5xl font-bold text-emerald-600 mr-2">{selectedCurrency}</Text>
                    <TextInput
                        value={monthlyBudget}
                        onChangeText={setMonthlyBudget}
                        keyboardType="numeric"
                        placeholder="30000"
                        placeholderTextColor="#64748b"
                        className="text-5xl font-bold text-slate-900 dark:text-white flex-1 text-center"
                        autoFocus
                    />
                </View>
                <Text className="text-slate-500 dark:text-slate-400 text-center text-sm">Total spending limit for the month</Text>
            </View>

            <View className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl">
                <Text className="text-blue-600 dark:text-blue-400 text-center text-sm">💡 Include food, transport, shopping, bills — everything</Text>
            </View>
        </View>
    );

    // ── Step 4: Reset Day ───────────────────────────────────────────────────
    const renderResetDay = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">Budget Reset Day 📅</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center mb-8 text-lg">When should your budget reset each month?</Text>

            <View className="bg-white dark:bg-slate-800 rounded-3xl p-8 mb-6 shadow-lg">
                <View className="flex-row items-center justify-center mb-4">
                    <TextInput
                        value={resetDay}
                        onChangeText={setResetDay}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#64748b"
                        className="text-6xl font-bold text-emerald-600 text-center w-24"
                        maxLength={2}
                    />
                    <Text className="text-3xl text-slate-500 dark:text-slate-400 ml-2">
                        {parseInt(resetDay) === 1 ? 'st' : parseInt(resetDay) === 2 ? 'nd' : parseInt(resetDay) === 3 ? 'rd' : 'th'}
                    </Text>
                </View>
                <Text className="text-slate-500 dark:text-slate-400 text-center text-sm mb-4">of every month</Text>
                <View className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl">
                    <Text className="text-slate-500 dark:text-slate-400 text-center text-sm">E.g. if you get paid on the 25th, set this to 25</Text>
                </View>
            </View>

            <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setResetDay('1')} className="flex-1 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                    <Text className="text-slate-900 dark:text-white text-center font-semibold">1st</Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-center text-xs">Start of month</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setResetDay('25')} className="flex-1 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                    <Text className="text-slate-900 dark:text-white text-center font-semibold">25th</Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-center text-xs">Salary day</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // ── Step 5: Budget Mode ─────────────────────────────────────────────────
    const renderBudgetMode = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">Budget Mode 🎯</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center mb-8 text-lg">How should your daily limit be calculated?</Text>

            <TouchableOpacity onPress={() => setBudgetMode('dynamic')} className="mb-4 rounded-3xl overflow-hidden">
                <LinearGradient
                    colors={budgetMode === 'dynamic' ? ['#059669', '#10b981'] : ['#1e293b', '#0f172a']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className={`text-2xl font-bold ${budgetMode === 'dynamic' ? 'text-white' : 'text-slate-300'}`}>Dynamic Mode</Text>
                        <View className={`w-6 h-6 rounded-full border-2 ${budgetMode === 'dynamic' ? 'bg-white border-white' : 'border-slate-500'}`}>
                            {budgetMode === 'dynamic' && <View className="w-full h-full bg-emerald-600 rounded-full scale-75" />}
                        </View>
                    </View>
                    <Text className={`${budgetMode === 'dynamic' ? 'text-emerald-50' : 'text-slate-400'} mb-2`}>Adjusts daily based on remaining budget</Text>
                    <Text className={`text-sm ${budgetMode === 'dynamic' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        ✓ Flexible spending{'\n'}✓ Unused budget rolls over{'\n'}✓ Recommended for most users
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setBudgetMode('fixed')} className="rounded-3xl overflow-hidden">
                <LinearGradient
                    colors={budgetMode === 'fixed' ? ['#2563eb', '#3b82f6'] : ['#1e293b', '#0f172a']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className={`text-2xl font-bold ${budgetMode === 'fixed' ? 'text-white' : 'text-slate-300'}`}>Fixed Mode</Text>
                        <View className={`w-6 h-6 rounded-full border-2 ${budgetMode === 'fixed' ? 'bg-white border-white' : 'border-slate-500'}`}>
                            {budgetMode === 'fixed' && <View className="w-full h-full bg-blue-600 rounded-full scale-75" />}
                        </View>
                    </View>
                    <Text className={`${budgetMode === 'fixed' ? 'text-blue-50' : 'text-slate-400'} mb-2`}>Same daily limit every day</Text>
                    <Text className={`text-sm ${budgetMode === 'fixed' ? 'text-blue-100' : 'text-slate-500'}`}>
                        ✓ Predictable spending{'\n'}✓ Strict discipline{'\n'}✓ Good for consistent budgets
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <StatusBar style="light" />
            <View className="flex-1">
                {renderStepIndicator()}

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {step === 1 && renderWelcome()}
                    {step === 2 && renderCurrency()}
                    {step === 3 && renderBudget()}
                    {step === 4 && renderResetDay()}
                    {step === 5 && renderBudgetMode()}
                </ScrollView>

                <View className="p-6 gap-3">
                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={isSaving}
                        className="bg-emerald-600 rounded-2xl overflow-hidden"
                    >
                        <LinearGradient colors={['#059669', '#10b981']} className="py-4">
                            <Text className="text-white text-center font-bold text-lg">
                                {isSaving ? 'Setting up...' : (step === totalSteps ? 'Get Started 🚀' : 'Continue')}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {step > 1 && (
                        <TouchableOpacity
                            onPress={() => setStep(step - 1)}
                            disabled={isSaving}
                            className="bg-slate-800 py-4 rounded-2xl"
                        >
                            <Text className="text-slate-300 text-center font-semibold text-lg">Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}
