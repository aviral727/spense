import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../db/client';
import { transactions, categories } from '../db/schema';
import { eq } from 'drizzle-orm';

const TRANSACTION_TYPES = ['expense', 'income'] as const;

export default function EditTransaction() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();
    const { currency } = useCurrency();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Others');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any>(null);

    useEffect(() => {
        loadTransaction();
        loadCategories();
    }, [id]);

    const loadTransaction = async () => {
        if (!id) {
            Alert.alert('Error', 'No transaction ID provided');
            router.back();
            return;
        }

        try {
            const result = await db.select().from(transactions).where(eq(transactions.id, parseInt(id)));
            if (result.length === 0) {
                Alert.alert('Error', 'Transaction not found');
                router.back();
                return;
            }

            const tx = result[0];
            setOriginalData(tx);
            setAmount(tx.amount.toString());
            setDescription(tx.description || '');
            setCategory(tx.category || 'Others');
            setType(tx.type as 'expense' | 'income');
        } catch (error) {
            console.error('Error loading transaction:', error);
            Alert.alert('Error', 'Failed to load transaction');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const cats = await db.select().from(categories);
            setAvailableCategories(cats.map(c => c.name));
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleSave = async () => {
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount');
            return;
        }

        setSaving(true);
        try {
            await db.update(transactions)
                .set({
                    amount: parsedAmount,
                    description: description.trim() || null,
                    category,
                    type,
                })
                .where(eq(transactions.id, parseInt(id!)));

            router.back();
        } catch (error) {
            console.error('Error saving transaction:', error);
            Alert.alert('Error', 'Failed to save transaction');
        } finally {
            setSaving(false);
        }
    };

    const handleIgnore = async () => {
        try {
            await db.update(transactions)
                .set({ isIgnored: !originalData?.isIgnored })
                .where(eq(transactions.id, parseInt(id!)));
            router.back();
        } catch (error) {
            console.error('Error toggling ignore:', error);
            Alert.alert('Error', 'Failed to update transaction');
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to permanently delete this transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await db.delete(transactions).where(eq(transactions.id, parseInt(id!)));
                            router.back();
                        } catch (error) {
                            console.error('Error deleting:', error);
                            Alert.alert('Error', 'Failed to delete transaction');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950 items-center justify-center">
                <Text className="text-gray-500">Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-emerald-600 font-semibold text-lg">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">Edit Transaction</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text className="text-emerald-600 font-semibold text-lg">
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                {/* Amount */}
                <View className="mb-6">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2 uppercase">Amount</Text>
                    <View className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex-row items-center">
                        <Text className="text-3xl font-bold text-emerald-600 mr-2">{currency}</Text>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#9ca3af"
                            className="text-3xl font-bold text-gray-900 dark:text-white flex-1"
                        />
                    </View>
                </View>

                {/* Type Toggle */}
                <View className="mb-6">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2 uppercase">Type</Text>
                    <View className="flex-row bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        {TRANSACTION_TYPES.map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setType(t)}
                                className={`flex-1 py-3 rounded-lg items-center ${type === t ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                            >
                                <Text className={`font-semibold capitalize ${type === t ? 'text-emerald-600' : 'text-gray-500'}`}>
                                    {t}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Category */}
                <View className="mb-6">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2 uppercase">Category</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {availableCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setCategory(cat)}
                                className={`px-4 py-2 rounded-full ${category === cat ? 'bg-emerald-600' : 'bg-gray-100 dark:bg-gray-800'}`}
                            >
                                <Text className={`font-medium ${category === cat ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Description */}
                <View className="mb-6">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2 uppercase">Description</Text>
                    <View className="bg-white dark:bg-gray-900 rounded-2xl p-4">
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Add a note..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={3}
                            className="text-gray-900 dark:text-white text-base"
                            style={{ minHeight: 80, textAlignVertical: 'top' }}
                        />
                    </View>
                </View>

                {/* Original SMS (if available) */}
                {originalData?.rawMessage && (
                    <View className="mb-6">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2 uppercase">Original SMS</Text>
                        <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4">
                            <Text className="text-gray-600 dark:text-gray-400 text-sm">{originalData.rawMessage}</Text>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <View className="gap-3 mb-8">
                    <TouchableOpacity
                        onPress={handleIgnore}
                        className="bg-amber-100 dark:bg-amber-900/30 py-4 rounded-2xl"
                    >
                        <Text className="text-amber-700 dark:text-amber-400 text-center font-semibold text-lg">
                            {originalData?.isIgnored ? '👁️ Unignore Transaction' : '🙈 Ignore Transaction'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleDelete}
                        className="bg-red-100 dark:bg-red-900/30 py-4 rounded-2xl"
                    >
                        <Text className="text-red-600 dark:text-red-400 text-center font-semibold text-lg">
                            🗑️ Delete Transaction
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
