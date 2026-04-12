import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import CategoryPicker from '../components/CategoryPicker';
import { suggestCategory } from '../utils/categoryRules';
import { LinearGradient } from 'expo-linear-gradient';
import { checkBudgetAlerts } from '../services/notificationService';

export default function AddTransaction() {
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [categoryIcon, setCategoryIcon] = useState('📦');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [manualCategorySet, setManualCategorySet] = useState(false);
    const [isIgnored, setIsIgnored] = useState(false);
    const router = useRouter();
    const { theme } = useTheme();
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!description || manualCategorySet) return;

        const suggested = suggestCategory(description);
        if (suggested && suggested !== 'Others') {
            setCategory(suggested);
            const iconMap: Record<string, string> = {
                'Ordered Food': '🍔',
                'Groceries': '🛒',
                'Online Purchases': '🛍️',
                'Subscriptions': '📅',
                'Fuel/Travel': '⛽',
                'Bills': '💡',
                'Health': '🏥',
                'Salary': '💰',
                'Entertainment': '🎬',
            };
            if (iconMap[suggested]) {
                setCategoryIcon(iconMap[suggested]);
            }
        }
    }, [description]);

    const handleSave = async () => {
        if (!amount || !category) return;
        setLoading(true);
        try {
            const result = await db.insert(transactions).values({
                amount: parseFloat(amount),
                category,
                date: Date.now(),
                type,
                description: description || null,
                source: 'manual',
                isIgnored: isIgnored,
            }).returning({ id: transactions.id });

            const newTxId = result[0]?.id;

            // Check for budget alerts and send balance update if spending
            if (type === 'expense' && !isIgnored && newTxId) {
                await checkBudgetAlerts(parseFloat(amount), newTxId); // Pass amount and ID
            }

            router.back();
        } catch (e) {
            console.error('Error saving transaction:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-slate-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <LinearGradient
                colors={
                    theme === 'dark'
                        ? ['#0f172a', '#0f172a']
                        : type === 'expense' ? ['#fff1f2', '#ffffff'] : ['#ecfdf5', '#ffffff']
                }
                className="flex-1"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 dark:bg-slate-950"
                >
                    <ScrollView className="flex-1 px-6 pt-12">
                        {/* Header with Type Switcher */}
                        <View className="flex-row justify-between items-center mb-10">
                            <TouchableOpacity
                                onPress={() => router.back()}
                                className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center"
                            >
                                <Text className="text-xl dark:text-white">✕</Text>
                            </TouchableOpacity>

                            <View className="flex-row bg-slate-100 dark:bg-slate-800 rounded-full p-1">
                                <TouchableOpacity
                                    onPress={() => setType('expense')}
                                    className="px-6 py-2 rounded-full"
                                    style={type === 'expense' ? { backgroundColor: theme === 'dark' ? '#1e293b' : 'white', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}}
                                >
                                    <Text className={`font-semibold ${type === 'expense' ? 'text-red-500' : 'text-gray-400'}`}>
                                        Expense
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setType('income')}
                                    className="px-6 py-2 rounded-full"
                                    style={type === 'income' ? { backgroundColor: theme === 'dark' ? '#1e293b' : 'white', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}}
                                >
                                    <Text className={`font-semibold ${type === 'income' ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        Income
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View className="w-10" />
                        </View>

                        {/* Hero Amount Input */}
                        <View className="items-center mb-12">
                            <Text className="text-gray-700 dark:text-gray-300 font-bold mb-4 uppercase tracking-widest text-xs">
                                Enter Amount
                            </Text>
                            <View className="flex-row items-center">
                                <Text className={`text-5xl font-bold mr-2 ${!amount ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                    {currency}
                                </Text>
                                <TextInput
                                    placeholder="0"
                                    keyboardType="numeric"
                                    className="text-7xl font-bold text-gray-900 dark:text-white min-w-[20%]"
                                    value={amount}
                                    onChangeText={setAmount}
                                    autoFocus
                                    placeholderTextColor="#6b7280"
                                />
                            </View>
                        </View>

                        <View className="gap-4">
                            {/* Category Selector */}
                            <TouchableOpacity
                                onPress={() => setShowCategoryPicker(true)}
                                className="flex-row items-center bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-sm"
                                style={{ borderRadius: 24, overflow: 'hidden' }}
                            >
                                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${category ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-700'}`}>
                                    <Text className="text-2xl">{categoryIcon}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider mb-1">Category</Text>
                                    <Text className={`text-lg font-semibold ${category ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {category || 'Select Category'}
                                    </Text>
                                </View>
                                <Text className="text-gray-400 text-xl">›</Text>
                            </TouchableOpacity>

                            {/* Description Input */}
                            <View
                                className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex-row items-start"
                                style={{ borderRadius: 24, overflow: 'hidden' }}
                            >
                                <View className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-700 items-center justify-center mr-4">
                                    <Text className="text-2xl">📝</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider mb-1">Note</Text>
                                    <TextInput
                                        placeholder="What is this for?"
                                        className="text-lg font-semibold text-gray-900 dark:text-white p-0"
                                        value={description}
                                        onChangeText={setDescription}
                                        multiline
                                        placeholderTextColor="#6b7280"
                                    />
                                </View>
                            </View>

                            {/* Ignore Toggle */}
                            <TouchableOpacity
                                onPress={() => setIsIgnored(!isIgnored)}
                                className={`p-5 border shadow-sm flex-row items-center justify-between ${isIgnored ? 'bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                                style={{ borderRadius: 24, overflow: 'hidden' }}
                            >
                                <View className="flex-row items-center flex-1 mr-4">
                                    <View className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-4">
                                        <Text className="text-2xl">🙈</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wider mb-1">Ignore this transaction</Text>
                                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                                            Don't count this in my budget
                                        </Text>
                                    </View>
                                </View>
                                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isIgnored ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {isIgnored && <Text className="text-white text-xs font-bold">✓</Text>}
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    {/* Footer Save Button */}
                    <View className="p-6 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading || !amount || !category}
                            className={`w-full py-5 items-center shadow-lg ${
                                loading || !amount || !category
                                    ? 'bg-slate-200 dark:bg-slate-800'
                                    : type === 'expense' ? 'bg-rose-600' : 'bg-emerald-600'
                                }`}
                            style={{ borderRadius: 24, overflow: 'hidden' }}
                        >
                            <Text className={`font-bold text-lg ${loading || !amount || !category ? 'text-gray-400' : 'text-white'}`}>
                                {loading ? 'Saving...' : 'Save Transaction'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </LinearGradient>

            <CategoryPicker
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                onSelect={(name, icon) => {
                    setCategory(name);
                    setCategoryIcon(icon);
                    setManualCategorySet(true);
                }}
            />
        </View>
    );
}
