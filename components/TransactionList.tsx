import { View, Text, SectionList, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { db } from '../db/client';
import { transactions, categories } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import { useCurrency } from '../context/CurrencyContext';

interface TransactionSection {
    title: string;
    data: any[];
}

interface Props {
    limit?: number;
    onRefresh?: () => void;
}

export default function TransactionList({ limit = 0, onRefresh }: Props) {
    const router = useRouter();
    const { currency } = useCurrency();
    const [sections, setSections] = useState<TransactionSection[]>([]);
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const loadCategories = async () => {
        try {
            const cats = await db.select().from(categories);
            const map: Record<string, string> = {};
            cats.forEach(cat => {
                map[cat.name] = cat.icon || '📦';
            });
            setCategoryMap(map);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadTransactions = async () => {
        try {
            let query = db.select().from(transactions).orderBy(desc(transactions.date));
            if (limit > 0) {
                // @ts-ignore - drizzle-orm limit is valid but might flag in some versions
                query = query.limit(limit);
            }
            const result = await query;

            // Group by date
            const grouped: Record<string, any[]> = {};
            result.forEach(item => {
                const date = new Date(item.date);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                let dateKey = date.toLocaleDateString();

                if (date.toDateString() === today.toDateString()) {
                    dateKey = 'Today';
                } else if (date.toDateString() === yesterday.toDateString()) {
                    dateKey = 'Yesterday';
                } else {
                    dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }

                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(item);
            });

            const sectionData = Object.keys(grouped).map(key => ({
                title: key,
                data: grouped[key]
            }));

            setSections(sectionData);
            if (Object.keys(categoryMap).length === 0) {
                loadCategories();
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    // Short press → navigate directly to edit screen
    const handleTransactionPress = (item: any) => {
        router.push({ pathname: '/edit-transaction', params: { id: item.id } });
    };

    // Long press → quick actions (Ignore / Delete)
    const handleTransactionLongPress = (item: any) => {
        Alert.alert(
            item.description || item.category,
            `${item.type === 'expense' ? '-' : '+'}${currency}${item.amount.toLocaleString('en-IN')}`,
            [
                {
                    text: item.isIgnored ? 'Unignore' : 'Ignore',
                    onPress: () => handleIgnoreToggle(item),
                    style: item.isIgnored ? 'default' : 'destructive',
                },
                {
                    text: 'Delete',
                    onPress: () => handleDelete(item),
                    style: 'destructive',
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleIgnoreToggle = async (item: any) => {
        try {
            await db.update(transactions)
                .set({ isIgnored: !item.isIgnored })
                .where(eq(transactions.id, item.id));
            loadTransactions();
            onRefresh?.();
        } catch (error) {
            console.error('Error toggling ignore:', error);
            Alert.alert('Error', 'Failed to update transaction');
        }
    };

    const handleDelete = (item: any) => {
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await db.delete(transactions).where(eq(transactions.id, item.id));
                            loadTransactions();
                            onRefresh?.();
                        } catch (error) {
                            console.error('Error deleting transaction:', error);
                            Alert.alert('Error', 'Failed to delete transaction');
                        }
                    },
                },
            ]
        );
    };

    useEffect(() => {
        loadTransactions();
        // Reload every 2 seconds to catch new transactions
        const interval = setInterval(loadTransactions, 2000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <View className="flex-1 mt-4">
                <Text className="text-xl font-bold mb-4 text-gray-800">Recent Activity</Text>
                <Text className="text-gray-400 text-center mt-4">Loading...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 mt-2">
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 80 }}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                    <View className="py-10 items-center">
                        <Text className="text-5xl mb-3 opacity-20">🧾</Text>
                        <Text className="text-gray-400 text-center">No transactions yet</Text>
                        <Text className="text-gray-300 text-xs mt-1">Tap + to add one</Text>
                    </View>
                }
                renderSectionHeader={({ section: { title } }) => (
                    <Text className="text-gray-500 dark:text-gray-400 font-semibold mb-2 mt-2 uppercase text-xs tracking-wider pl-1">
                        {title}
                    </Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleTransactionPress(item)}
                        onLongPress={() => handleTransactionLongPress(item)}
                        delayLongPress={400}
                        activeOpacity={0.7}
                        className={`p-4 bg-white dark:bg-gray-900 mb-2 shadow-sm border border-gray-50 dark:border-gray-800 flex-row items-center justify-between ${item.isIgnored ? 'opacity-50' : ''}`}
                        style={{ borderRadius: 24 }}
                    >
                        <View className="flex-row items-center gap-3 flex-1">
                            <View className="bg-gray-50 dark:bg-gray-800 w-12 h-12 rounded-full items-center justify-center">
                                <Text className="text-2xl">{item.isIgnored ? '🙈' : (categoryMap[item.category] || '📦')}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className={`font-bold text-gray-900 dark:text-white text-base ${item.isIgnored ? 'line-through text-gray-400' : ''}`}>{item.category}</Text>
                                <Text className="text-gray-500 dark:text-gray-400 text-xs" numberOfLines={1}>
                                    {item.description || item.rawMessage || 'No description'}
                                </Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className={`font-bold text-base ${item.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'} ${item.isIgnored ? 'line-through text-gray-400' : ''}`}>
                                {item.type === 'expense' ? '-' : '+'}{currency}{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                            <Text className="text-emerald-500 text-xs mt-0.5">✏️ Edit</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
