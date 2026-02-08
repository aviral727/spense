import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateBudgetSettings } from '../services/budgetService';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { initializeSmsListener, importHistoricalSms } from '../services/autoSync';
import { db } from '../db/client';
import { transactions } from '../db/schema';

const ONBOARDING_KEY = 'onboarding_completed';

export default function OnboardingScreen() {
    const router = useRouter();
    const { currency, setCurrency } = useCurrency();
    const { theme } = useTheme();

    const [step, setStep] = useState(1);
    const [monthlyBudget, setMonthlyBudget] = useState('');
    const [resetDay, setResetDay] = useState('1');
    const [budgetMode, setBudgetMode] = useState<'dynamic' | 'fixed'>('dynamic');
    const [selectedCurrency, setSelectedCurrency] = useState('₹');
    const [importChoice, setImportChoice] = useState<'import' | 'fresh' | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const totalSteps = 6;

    // Auto-detect settings from system
    const detectSystemSettings = () => {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        if (locale.includes('IN')) setSelectedCurrency('₹');
        else if (locale.includes('US')) setSelectedCurrency('$');
        else if (locale.includes('GB')) setSelectedCurrency('£');
        else if (locale.includes('EU')) setSelectedCurrency('€');
        else if (locale.includes('JP') || locale.includes('CN')) setSelectedCurrency('¥');

        setMonthlyBudget('30000');
        setResetDay('1');

        Alert.alert(
            'Settings Detected',
            'We\'ve suggested some settings based on your location. You can adjust them if needed.',
            [{ text: 'OK' }]
        );
    };

    const handleNext = async () => {
        // Step 1: Welcome - No validation

        if (step === 2) {
            if (!selectedCurrency) {
                Alert.alert('Required', 'Please select a currency');
                return;
            }
            setCurrency(selectedCurrency);
        }

        if (step === 3) {
            const budget = parseFloat(monthlyBudget);
            if (!monthlyBudget || isNaN(budget) || budget <= 0) {
                Alert.alert('Invalid Budget', 'Please enter a valid monthly budget');
                return;
            }
        }

        if (step === 4) {
            const day = parseInt(resetDay);
            if (!resetDay || isNaN(day) || day < 1 || day > 28) {
                Alert.alert('Invalid Day', 'Please enter a day between 1 and 28');
                return;
            }
        }

        // Step 5: Budget Mode - No validation needed

        if (step === 6) {
            // Import Choice step - validate selection
            if (!importChoice) {
                Alert.alert('Please Choose', 'Select whether to import previous transactions or start fresh');
                return;
            }
        }

        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            await completeOnboarding();
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const completeOnboarding = async () => {
        try {
            setIsImporting(true);

            // Save budget settings
            await updateBudgetSettings(
                parseFloat(monthlyBudget),
                parseInt(resetDay),
                budgetMode
            );

            // If user chose to start fresh, set timestamps to NOW and clear transactions
            if (importChoice === 'fresh') {
                try {
                    // Set installation and sync timestamps to NOW
                    // This prevents syncMissedSMS from importing old messages
                    const now = Date.now().toString();
                    await AsyncStorage.setItem('installationTimestamp', now);
                    await AsyncStorage.setItem('lastSyncTimestamp', now);
                    console.log('Set timestamps to NOW for fresh start');

                    // Clear any existing transactions
                    await db.delete(transactions);
                    console.log('Cleared existing transactions for fresh start');
                } catch (err) {
                    console.log('Error setting up fresh start:', err);
                }
            }

            // Mark onboarding as complete
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

            // Initialize SMS listener (requests permission)
            if (Platform.OS === 'android') {
                try {
                    await initializeSmsListener();

                    // If user chose to import, trigger historical import
                    if (importChoice === 'import') {
                        await importHistoricalSms();
                    }
                } catch (err) {
                    console.log('Error initializing SMS listener:', err);
                }
            }

            // Navigate to main app
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error completing onboarding:', error);
            Alert.alert('Error', 'Failed to save settings. Please try again.');
        } finally {
            setIsImporting(false);
        }
    };

    const renderStepIndicator = () => (
        <View className="flex-row justify-center mb-8 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <View
                    key={i}
                    className={`h-2 rounded-full ${i === step ? 'w-8 bg-emerald-600' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
                />
            ))}
        </View>
    );

    const renderWelcome = () => (
        <View className="flex-1 justify-center px-6">
            <View className="mb-8 items-center">
                <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                    Welcome to{'\n'}Money Tracker! 👋
                </Text>
                <Text className="text-gray-600 dark:text-gray-400 text-center text-lg px-4 mt-2">
                    Your journey to financial discipline starts here. Let's set up your secure expense manager.
                </Text>
            </View>

            <View className="bg-white dark:bg-gray-900 rounded-3xl p-6 mb-6 shadow-lg">
                <View className="flex-row gap-4 mb-6">
                    <View className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">📱</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                            Why SMS Permission?
                        </Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-sm leading-5">
                            To automatically read bank alerts and track expenses without manual entry.
                        </Text>
                    </View>
                </View>

                <View className="flex-row gap-4 mb-6">
                    <View className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">🔒</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                            100% Private
                        </Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-sm leading-5">
                            All processing happens locally on your phone. Your data never leaves your device.
                        </Text>
                    </View>
                </View>

                <View className="flex-row gap-4">
                    <View className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl items-center justify-center">
                        <Text className="text-2xl">✅</Text>
                    </View>
                    <View className="flex-1 justify-center">
                        <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
                            Safe & Trusted
                        </Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-sm leading-5">
                            Verified safe when downloaded from trusted sources like Google Play.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderCurrency = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Select Currency 💱
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center mb-8 text-lg">
                Choose your local currency for tracking
            </Text>

            <View className="bg-white dark:bg-gray-900 rounded-3xl p-6 mb-6 shadow-lg">
                <Text className="text-gray-900 dark:text-white font-bold text-xl mb-4">
                    Select Your Currency
                </Text>
                <View className="flex-row flex-wrap gap-3">
                    {['₹', '$', '€', '£', '¥'].map((curr) => (
                        <TouchableOpacity
                            key={curr}
                            onPress={() => setSelectedCurrency(curr)}
                            className={`flex-1 min-w-[60px] h-16 rounded-2xl items-center justify-center ${selectedCurrency === curr
                                ? 'bg-emerald-600'
                                : 'bg-gray-100 dark:bg-gray-800'
                                }`}
                        >
                            <Text
                                className={`text-2xl font-bold ${selectedCurrency === curr ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                {curr}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                onPress={detectSystemSettings}
                className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl mb-4"
            >
                <Text className="text-blue-600 dark:text-blue-400 text-center font-semibold">
                    🤖 Auto-detect from system settings
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderBudget = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Monthly Budget 💰
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center mb-8 text-lg">
                How much do you want to spend each month?
            </Text>

            <View className="bg-white dark:bg-gray-900 rounded-3xl p-8 mb-6 shadow-lg">
                <View className="flex-row items-center justify-center mb-4">
                    <Text className="text-5xl font-bold text-emerald-600 mr-2">{selectedCurrency}</Text>
                    <TextInput
                        value={monthlyBudget}
                        onChangeText={setMonthlyBudget}
                        keyboardType="numeric"
                        placeholder="30000"
                        placeholderTextColor="#9ca3af"
                        className="text-5xl font-bold text-gray-900 dark:text-white flex-1 text-center"
                        autoFocus
                    />
                </View>
                <Text className="text-gray-500 dark:text-gray-400 text-center text-sm">
                    This will be your total spending limit for the month
                </Text>
            </View>

            <View className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl">
                <Text className="text-blue-600 dark:text-blue-400 text-center text-sm">
                    💡 Tip: Include all expenses like food, transport, shopping, etc.
                </Text>
            </View>
        </View>
    );

    const renderResetDay = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Budget Reset Day 📅
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center mb-8 text-lg">
                When should your budget reset each month?
            </Text>

            <View className="bg-white dark:bg-gray-900 rounded-3xl p-8 mb-6 shadow-lg">
                <View className="flex-row items-center justify-center mb-4">
                    <TextInput
                        value={resetDay}
                        onChangeText={setResetDay}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#9ca3af"
                        className="text-6xl font-bold text-emerald-600 text-center w-24"
                        maxLength={2}
                    />
                    <Text className="text-3xl text-gray-500 dark:text-gray-400 ml-2">
                        {parseInt(resetDay) === 1 ? 'st' : parseInt(resetDay) === 2 ? 'nd' : parseInt(resetDay) === 3 ? 'rd' : 'th'}
                    </Text>
                </View>
                <Text className="text-gray-500 dark:text-gray-400 text-center text-sm mb-4">
                    of every month
                </Text>

                <View className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                    <Text className="text-gray-600 dark:text-gray-400 text-center text-sm">
                        Example: If you get paid on the 25th, set this to 25
                    </Text>
                </View>
            </View>

            <View className="flex-row gap-3">
                <TouchableOpacity
                    onPress={() => setResetDay('1')}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl"
                >
                    <Text className="text-gray-900 dark:text-white text-center font-semibold">1st</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-center text-xs">Start of month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setResetDay('25')}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl"
                >
                    <Text className="text-gray-900 dark:text-white text-center font-semibold">25th</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-center text-xs">Salary day</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderBudgetMode = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Budget Mode 🎯
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center mb-8 text-lg">
                Choose how your daily budget is calculated
            </Text>

            <TouchableOpacity
                onPress={() => setBudgetMode('dynamic')}
                className={`mb-4 rounded-3xl overflow-hidden ${budgetMode === 'dynamic' ? 'ring-4 ring-emerald-600' : ''}`}
            >
                <LinearGradient
                    colors={budgetMode === 'dynamic' ? ['#059669', '#10b981'] : ['#f3f4f6', '#e5e7eb']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className={`text-2xl font-bold ${budgetMode === 'dynamic' ? 'text-white' : 'text-gray-900'}`}>
                            Dynamic Mode
                        </Text>
                        <View className={`w-6 h-6 rounded-full border-2 ${budgetMode === 'dynamic' ? 'bg-white border-white' : 'border-gray-400'}`}>
                            {budgetMode === 'dynamic' && (
                                <View className="w-full h-full bg-emerald-600 rounded-full scale-75" />
                            )}
                        </View>
                    </View>
                    <Text className={`${budgetMode === 'dynamic' ? 'text-emerald-50' : 'text-gray-600'} mb-2`}>
                        Adjusts daily based on remaining budget
                    </Text>
                    <Text className={`text-sm ${budgetMode === 'dynamic' ? 'text-emerald-100' : 'text-gray-500'}`}>
                        ✓ Flexible spending{'\n'}
                        ✓ Unused budget rolls over{'\n'}
                        ✓ Recommended for most users
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setBudgetMode('fixed')}
                className={`rounded-3xl overflow-hidden ${budgetMode === 'fixed' ? 'ring-4 ring-blue-600' : ''}`}
            >
                <LinearGradient
                    colors={budgetMode === 'fixed' ? ['#2563eb', '#3b82f6'] : ['#f3f4f6', '#e5e7eb']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className={`text-2xl font-bold ${budgetMode === 'fixed' ? 'text-white' : 'text-gray-900'}`}>
                            Fixed Mode
                        </Text>
                        <View className={`w-6 h-6 rounded-full border-2 ${budgetMode === 'fixed' ? 'bg-white border-white' : 'border-gray-400'}`}>
                            {budgetMode === 'fixed' && (
                                <View className="w-full h-full bg-blue-600 rounded-full scale-75" />
                            )}
                        </View>
                    </View>
                    <Text className={`${budgetMode === 'fixed' ? 'text-blue-50' : 'text-gray-600'} mb-2`}>
                        Same daily limit every day
                    </Text>
                    <Text className={`text-sm ${budgetMode === 'fixed' ? 'text-blue-100' : 'text-gray-500'}`}>
                        ✓ Predictable spending{'\n'}
                        ✓ Strict discipline{'\n'}
                        ✓ Good for consistent budgets
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderImportChoice = () => (
        <View className="flex-1 justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Import History? 📥
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center mb-8 text-lg">
                Would you like to import your previous bank SMS transactions?
            </Text>

            <TouchableOpacity
                onPress={() => setImportChoice('import')}
                className={`mb-4 rounded-3xl overflow-hidden`}
            >
                <LinearGradient
                    colors={importChoice === 'import' ? ['#059669', '#10b981'] : ['#f3f4f6', '#e5e7eb']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-3">
                            <Text className="text-3xl">📲</Text>
                            <Text className={`text-xl font-bold ${importChoice === 'import' ? 'text-white' : 'text-gray-900'}`}>
                                Import Previous
                            </Text>
                        </View>
                        <View className={`w-6 h-6 rounded-full border-2 ${importChoice === 'import' ? 'bg-white border-white' : 'border-gray-400'}`}>
                            {importChoice === 'import' && (
                                <View className="w-full h-full bg-emerald-600 rounded-full scale-75" />
                            )}
                        </View>
                    </View>
                    <Text className={`${importChoice === 'import' ? 'text-emerald-50' : 'text-gray-600'}`}>
                        Import transactions from your existing bank SMS messages. Great for seeing your spending history right away.
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setImportChoice('fresh')}
                className={`rounded-3xl overflow-hidden`}
            >
                <LinearGradient
                    colors={importChoice === 'fresh' ? ['#2563eb', '#3b82f6'] : ['#f3f4f6', '#e5e7eb']}
                    className="p-6"
                >
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-3">
                            <Text className="text-3xl">✨</Text>
                            <Text className={`text-xl font-bold ${importChoice === 'fresh' ? 'text-white' : 'text-gray-900'}`}>
                                Start Fresh
                            </Text>
                        </View>
                        <View className={`w-6 h-6 rounded-full border-2 ${importChoice === 'fresh' ? 'bg-white border-white' : 'border-gray-400'}`}>
                            {importChoice === 'fresh' && (
                                <View className="w-full h-full bg-blue-600 rounded-full scale-75" />
                            )}
                        </View>
                    </View>
                    <Text className={`${importChoice === 'fresh' ? 'text-blue-50' : 'text-gray-600'}`}>
                        Start with a clean slate. Only new transactions from today onwards will be tracked.
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            <View className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-2xl mt-6">
                <Text className="text-amber-700 dark:text-amber-400 text-center text-sm">
                    💡 You can always manually add past transactions later from Settings
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

            <View className="flex-1">
                {renderStepIndicator()}

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {step === 1 && renderWelcome()}
                    {step === 2 && renderCurrency()}
                    {step === 3 && renderBudget()}
                    {step === 4 && renderResetDay()}
                    {step === 5 && renderBudgetMode()}
                    {step === 6 && renderImportChoice()}
                </ScrollView>

                {/* Navigation Buttons */}
                <View className="p-6 gap-3">
                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={isImporting}
                        className="bg-emerald-600 rounded-2xl overflow-hidden"
                    >
                        <LinearGradient
                            colors={['#059669', '#10b981']}
                            className="py-4"
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {isImporting ? 'Setting up...' : (step === totalSteps ? 'Get Started 🚀' : 'Continue')}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {step > 1 && (
                        <TouchableOpacity
                            onPress={handleBack}
                            disabled={isImporting}
                            className="bg-gray-200 dark:bg-gray-800 py-4 rounded-2xl"
                        >
                            <Text className="text-gray-900 dark:text-white text-center font-semibold text-lg">
                                Back
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}
