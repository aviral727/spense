import { Tabs } from "expo-router";
import { View, Text, Platform, TouchableOpacity, Animated } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useRef, useEffect } from "react";

interface TabItem {
    name: string;
    title: string;
    label: string;
    iconActive: string;
    iconInactive: string;
}

const TABS: TabItem[] = [
    { name: "index", title: "Home", label: "Overview", iconActive: "🏠", iconInactive: "🏚️" },
    { name: "transactions", title: "Transactions", label: "Transactions", iconActive: "📝", iconInactive: "📄" },
    { name: "analysis", title: "Analysis", label: "Analysis", iconActive: "📊", iconInactive: "📈" },
];

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <View
            style={{
                flexDirection: 'row',
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderTopColor: isDark ? '#1e293b' : '#f1f5f9',
                borderTopWidth: 1,
                paddingBottom: Platform.OS === 'ios' ? 28 : 16,
                paddingTop: 10,
                paddingHorizontal: 12,
            }}
        >
            {state.routes.map((route: any, index: number) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;
                const tab = TABS[index];

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });
                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (
                    <TouchableOpacity
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        onPress={onPress}
                        activeOpacity={0.7}
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {isFocused ? (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 20,
                                    gap: 6,
                                    // Floating card effect
                                    elevation: 4,
                                    shadowColor: '#059669',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.25,
                                    shadowRadius: 4,
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>{tab.iconActive}</Text>
                                <Text
                                    style={{
                                        color: isDark ? '#34d399' : '#059669',
                                        fontWeight: '700',
                                        fontSize: 13,
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                                <Text style={{ fontSize: 22, opacity: 0.5 }}>{tab.iconInactive}</Text>
                                <Text
                                    style={{
                                        color: isDark ? '#6b7280' : '#94a3b8',
                                        fontSize: 11,
                                        marginTop: 2,
                                        fontWeight: '500',
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function TabsLayout() {
    const { theme } = useTheme();

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tabs.Screen name="index" options={{ title: "Home" }} />
            <Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
            <Tabs.Screen name="analysis" options={{ title: "Analysis" }} />
        </Tabs>
    );
}
