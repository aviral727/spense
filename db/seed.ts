import { db } from './client';
import { categories } from './schema';

const defaultCategories = [
    { name: 'Ordered Food', icon: '🍔' },
    { name: 'Groceries', icon: '🛒' },
    { name: 'Online Purchases', icon: '🛍️' },
    { name: 'Subscriptions', icon: '📅' },
    { name: 'Fuel/Travel', icon: '⛽' },
    { name: 'Bills', icon: '💡' },
    { name: 'Health', icon: '🏥' },
    { name: 'Salary', icon: '💰' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Others', icon: '📦' },
];

export async function seedCategories() {
    try {
        // Check if categories already exist
        const existing = await db.select().from(categories);

        if (existing.length === 0) {
            console.log('Seeding default categories...');
            for (const category of defaultCategories) {
                await db.insert(categories).values(category);
            }
            console.log('Categories seeded successfully');
        } else {
            console.log('Categories already seeded');
        }
    } catch (error) {
        console.error('Error seeding categories:', error);
    }
}
