import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import TransactionList from "../../components/TransactionList"; // Adjusted import path
import { useTheme } from "../../context/ThemeContext";

export default function TransactionsScreen() {
    const { theme } = useTheme();

    return (
        <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-950">
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <View className="flex-1 px-4 pt-2">
                <View className="mb-4 mt-2">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                        Transactions
                    </Text>
                </View>

                {/* Reusing existing component for now */}
                <TransactionList limit={50} />
            </View>
        </SafeAreaView>
    );
}
