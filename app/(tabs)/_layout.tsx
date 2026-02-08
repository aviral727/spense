import { Tabs } from "expo-router";
import { View, Text, Platform } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export default function TabsLayout() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? '#0c0a09' : '#ffffff',
                    borderTopColor: isDark ? '#1c1917' : '#e5e7eb',
                    height: Platform.OS === 'ios' ? 88 : 80,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 22,
                    paddingTop: 12,
                },
                tabBarActiveTintColor: '#059669',
                tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, focused }) => (
                        <View className="items-center justify-center">
                            <Text style={{ color, fontSize: 24 }}>
                                {focused ? "🏠" : "🏚️"}
                            </Text>
                        </View>
                    ),
                    tabBarLabel: "Overview",
                }}
            />
            <Tabs.Screen
                name="transactions"
                options={{
                    title: "Transactions",
                    tabBarIcon: ({ color, focused }) => (
                        <View className="items-center justify-center">
                            <Text style={{ color, fontSize: 24 }}>
                                {focused ? "📝" : "📄"}
                            </Text>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="analysis"
                options={{
                    title: "Analysis",
                    tabBarIcon: ({ color, focused }) => (
                        <View className="items-center justify-center">
                            <Text style={{ color, fontSize: 24 }}>
                                {focused ? "📊" : "📈"}
                            </Text>
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
}
