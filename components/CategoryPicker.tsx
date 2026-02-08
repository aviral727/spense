import { View, Text, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { db } from '../db/client';
import { categories } from '../db/schema';

interface CategoryPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (categoryName: string, categoryIcon: string) => void;
}

export default function CategoryPicker({ visible, onClose, onSelect }: CategoryPickerProps) {
    const [categoryList, setCategoryList] = useState<any[]>([]);
    const [showAddNew, setShowAddNew] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('📦');

    useEffect(() => {
        if (visible) {
            loadCategories();
        }
    }, [visible]);

    const loadCategories = async () => {
        try {
            const result = await db.select().from(categories);
            setCategoryList(result);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleSelect = (name: string, icon: string | null) => {
        onSelect(name, icon || '📦');
        onClose();
    };

    const handleAddNew = async () => {
        if (!newCategoryName.trim()) return;

        try {
            await db.insert(categories).values({
                name: newCategoryName.trim(),
                icon: newCategoryIcon,
            });
            await loadCategories();
            setNewCategoryName('');
            setNewCategoryIcon('📦');
            setShowAddNew(false);
        } catch (error) {
            console.error('Error adding category:', error);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-bold text-gray-900">Select Category</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-gray-500 text-2xl">✕</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={categoryList}
                        numColumns={2}
                        keyExtractor={(item) => item.id.toString()}
                        showsVerticalScrollIndicator={false}
                        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleSelect(item.name, item.icon)}
                                className="bg-gray-100 px-4 py-3 rounded-2xl active:bg-gray-200"
                                style={{ flexDirection: 'row', alignItems: 'center', width: '48%' }}
                            >
                                <Text style={{ fontSize: 24, marginRight: 8 }}>{item.icon}</Text>
                                <Text className="text-gray-800 font-semibold" numberOfLines={1}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                        ListFooterComponent={
                            <View style={{ marginTop: 8 }}>
                                {!showAddNew ? (
                                    <TouchableOpacity
                                        onPress={() => setShowAddNew(true)}
                                        className="bg-blue-50 p-4 rounded-2xl items-center border-2 border-dashed border-blue-300"
                                    >
                                        <Text className="text-blue-600 font-semibold">+ Add New Category</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View className="bg-gray-50 p-4 rounded-2xl">
                                        <Text className="font-semibold text-gray-700 mb-3">New Category</Text>
                                        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                                            <TextInput
                                                placeholder="Icon"
                                                value={newCategoryIcon}
                                                onChangeText={setNewCategoryIcon}
                                                className="bg-white px-4 py-3 rounded-xl text-center"
                                                style={{ width: 64, fontSize: 24, marginRight: 8 }}
                                                maxLength={2}
                                            />
                                            <TextInput
                                                placeholder="Category name"
                                                value={newCategoryName}
                                                onChangeText={setNewCategoryName}
                                                className="bg-white px-4 py-3 rounded-xl"
                                                style={{ flex: 1 }}
                                            />
                                        </View>
                                        <View style={{ flexDirection: 'row' }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setShowAddNew(false);
                                                    setNewCategoryName('');
                                                    setNewCategoryIcon('📦');
                                                }}
                                                className="bg-gray-200 p-3 rounded-xl"
                                                style={{ flex: 1, marginRight: 8 }}
                                            >
                                                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={handleAddNew}
                                                className="bg-blue-600 p-3 rounded-xl"
                                                style={{ flex: 1 }}
                                            >
                                                <Text className="text-white font-semibold text-center">Add</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}
