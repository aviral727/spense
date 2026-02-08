import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    amount: real('amount').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    date: integer('date').notNull(), // Unix timestamp (ms)
    type: text('type').notNull(), // 'income' | 'expense'
    source: text('source').default('manual'), // 'manual', 'sms', 'email'
    // Transaction Intelligence fields
    transactionClass: text('transaction_class').default('spending'), // 'spending' | 'income' | 'transfer' | 'refund' | 'atm' | 'cc_payment'
    linkedTransactionId: integer('linked_transaction_id'), // FK to paired transaction (for transfers/refunds)
    rawSmsHash: text('raw_sms_hash'), // Hash for better deduplication
    account: text('account'), // Last 4 digits of account/card
    isIgnored: integer('is_ignored', { mode: 'boolean' }).default(false), // User manually excluded from budget
});

export const categories = sqliteTable('categories', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    icon: text('icon'), // Emoji or icon name
});

export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
});
