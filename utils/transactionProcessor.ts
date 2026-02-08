import { ParsedTransaction } from './smsParser';

export type TransactionClass = 'spending' | 'income' | 'salary' | 'transfer' | 'refund' | 'atm' | 'cc_payment';

export interface ProcessedTransaction extends ParsedTransaction {
    transactionClass: TransactionClass;
    linkedTransactionId?: number;
    rawSmsHash: string;
    confidence: number; // 0-100
}

// ============ CLASSIFICATION KEYWORDS ============

// Credit Card Payment - NOT real spending
const CC_PAYMENT_PATTERNS = [
    /cardmember.*credited/i,
    /credited to your card/i,
    /payment.*towards.*card/i,
    /card.*payment.*received/i,
    /thank you for.*payment.*card/i,
];

// Salary / NEFT Credit - Real income
const SALARY_PATTERNS = [
    /neft cr/i,
    /salary/i,
    /wages/i,
    /stipend/i,
];

// ATM Withdrawal - Not spending (cash conversion)
const ATM_KEYWORDS = ['atm', 'cash withdrawal', 'cash wdl', 'atm-cash', 'atm/cdm'];

// Refund - Reduces expenses
const REFUND_KEYWORDS = ['refund', 'reversal', 'cashback', 'returned', 'refunded'];

// Failed/Declined - Should be filtered out
const FAILED_KEYWORDS = ['failed', 'declined', 'unsuccessful', 'could not'];

// ============ HELPER FUNCTIONS ============

/**
 * Generate a hash from SMS body for deduplication
 */
export function generateSmsHash(body: string): string {
    const normalized = body
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * Classify a single transaction using PRIORITY RULES
 * Order matters - check most specific patterns first
 */
export function classifyTransaction(tx: ParsedTransaction): { transactionClass: TransactionClass; confidence: number } {
    const bodyLower = tx.rawMessage.toLowerCase();

    // RULE 1: Credit Card Payment (highest priority - "credited" can be misleading)
    if (CC_PAYMENT_PATTERNS.some(pattern => pattern.test(tx.rawMessage))) {
        return { transactionClass: 'cc_payment', confidence: 95 };
    }

    // RULE 2: Failed transactions - filter out
    if (FAILED_KEYWORDS.some(kw => bodyLower.includes(kw))) {
        return { transactionClass: tx.type === 'expense' ? 'spending' : 'income', confidence: 10 };
    }

    // RULE 3: ATM Withdrawal
    if (ATM_KEYWORDS.some(kw => bodyLower.includes(kw))) {
        return { transactionClass: 'atm', confidence: 90 };
    }

    // RULE 4: Refund
    if (REFUND_KEYWORDS.some(kw => bodyLower.includes(kw))) {
        return { transactionClass: 'refund', confidence: 85 };
    }

    // RULE 5: Salary / NEFT Credit (for income transactions)
    if (tx.type === 'income') {
        if (SALARY_PATTERNS.some(pattern => pattern.test(tx.rawMessage))) {
            return { transactionClass: 'salary', confidence: 90 };
        }
        // Large deposits (>50000) are likely salary
        if (tx.amount >= 50000 && bodyLower.includes('deposited')) {
            return { transactionClass: 'salary', confidence: 75 };
        }
    }

    // RULE 6: Default - real spending or income
    return {
        transactionClass: tx.type === 'expense' ? 'spending' : 'income',
        confidence: 70
    };
}

/**
 * Detect self-transfers by matching UPI Reference Numbers
 * This is more accurate than time-based matching
 */
export function detectSelfTransfers(
    transactions: ProcessedTransaction[]
): Map<number, number> {
    const pairs = new Map<number, number>();

    // Group transactions by UPI Ref
    const byRef = new Map<string, number[]>();

    transactions.forEach((tx, idx) => {
        if (tx.upiRef) {
            const existing = byRef.get(tx.upiRef) || [];
            existing.push(idx);
            byRef.set(tx.upiRef, existing);
        }
    });

    // Find pairs: same ref, one debit + one credit, same amount
    for (const [ref, indices] of byRef.entries()) {
        if (indices.length === 2) {
            const [idx1, idx2] = indices;
            const tx1 = transactions[idx1];
            const tx2 = transactions[idx2];

            // One must be expense, one must be income
            const hasDebit = tx1.type === 'expense' || tx2.type === 'expense';
            const hasCredit = tx1.type === 'income' || tx2.type === 'income';

            // Amounts should match (within ₹1 tolerance)
            const amountsMatch = Math.abs(tx1.amount - tx2.amount) < 1.0;

            if (hasDebit && hasCredit && amountsMatch) {
                pairs.set(idx1, idx2);
                pairs.set(idx2, idx1);
                console.log(`🔗 Matched transfer pair by Ref ${ref}: ₹${tx1.amount}`);
            }
        }
    }

    // Fallback: Time-based matching for transactions without UPI Ref
    const usedIndices = new Set(pairs.keys());
    const timeWindowMs = 30 * 60 * 1000; // 30 minutes

    for (let i = 0; i < transactions.length; i++) {
        const debit = transactions[i];
        if (debit.type !== 'expense' || usedIndices.has(i)) continue;

        for (let j = i + 1; j < transactions.length; j++) {
            const credit = transactions[j];
            if (credit.type !== 'income' || usedIndices.has(j)) continue;

            const timeDiff = Math.abs(credit.date - debit.date);
            const amountMatch = Math.abs(credit.amount - debit.amount) < 1.0;
            const differentAccounts = debit.account !== credit.account;

            if (amountMatch && differentAccounts && timeDiff < timeWindowMs) {
                pairs.set(i, j);
                pairs.set(j, i);
                usedIndices.add(i);
                usedIndices.add(j);
                console.log(`🔗 Matched transfer pair by time: ₹${debit.amount}`);
                break;
            }
        }
    }

    return pairs;
}

/**
 * Detect refunds and link them to original purchases
 */
export function detectRefunds(
    transactions: ProcessedTransaction[],
    refundWindowDays: number = 30
): Map<number, number> {
    const links = new Map<number, number>();
    const refundWindowMs = refundWindowDays * 24 * 60 * 60 * 1000;

    const refundIndices = transactions
        .map((tx, idx) => ({ tx, idx }))
        .filter(({ tx }) => tx.transactionClass === 'refund');

    for (const { tx: refund, idx: refundIdx } of refundIndices) {
        for (let i = 0; i < transactions.length; i++) {
            const purchase = transactions[i];

            if (purchase.type !== 'expense') continue;
            if (purchase.date >= refund.date) continue;
            if (refund.date - purchase.date > refundWindowMs) continue;

            if (Math.abs(purchase.amount - refund.amount) < 1.0) {
                links.set(refundIdx, i);
                break;
            }
        }
    }

    return links;
}

/**
 * Process raw parsed transactions and apply intelligence
 */
export function processTransactions(rawTransactions: ParsedTransaction[]): ProcessedTransaction[] {
    // Step 1: Initial classification and hash generation
    const processed: ProcessedTransaction[] = rawTransactions.map(tx => {
        const { transactionClass, confidence } = classifyTransaction(tx);
        return {
            ...tx,
            transactionClass,
            rawSmsHash: generateSmsHash(tx.rawMessage),
            confidence
        };
    });

    // Step 2: Detect self-transfers (by UPI Ref or time)
    const transferPairs = detectSelfTransfers(processed);
    for (const [idx, pairedIdx] of transferPairs.entries()) {
        processed[idx].transactionClass = 'transfer';
        processed[idx].linkedTransactionId = pairedIdx;
    }

    // Step 3: Detect and link refunds
    const refundLinks = detectRefunds(processed);
    for (const [refundIdx, purchaseIdx] of refundLinks.entries()) {
        processed[refundIdx].linkedTransactionId = purchaseIdx;
    }

    // Step 4: Filter out low-confidence (failed) transactions
    const filtered = processed.filter(tx => tx.confidence > 20);

    // Log summary
    const summary = {
        total: filtered.length,
        spending: filtered.filter(t => t.transactionClass === 'spending').length,
        salary: filtered.filter(t => t.transactionClass === 'salary').length,
        transfers: filtered.filter(t => t.transactionClass === 'transfer').length,
        ccPayments: filtered.filter(t => t.transactionClass === 'cc_payment').length,
        refunds: filtered.filter(t => t.transactionClass === 'refund').length,
        atm: filtered.filter(t => t.transactionClass === 'atm').length,
    };
    console.log('📊 Transaction Classification Summary:', summary);

    return filtered;
}

/**
 * Deduplicate transactions based on SMS hash
 */
export function deduplicateByHash(
    newTransactions: ProcessedTransaction[],
    existingHashes: Set<string>
): ProcessedTransaction[] {
    return newTransactions.filter(tx => !existingHashes.has(tx.rawSmsHash));
}

/**
 * Calculate net spending (excludes transfers, ATM, CC payments, salary)
 */
export function calculateNetSpending(transactions: ProcessedTransaction[]): {
    totalSpending: number;
    totalIncome: number;
    totalSalary: number;
    transferVolume: number;
} {
    let totalSpending = 0;
    let totalIncome = 0;
    let totalSalary = 0;
    let transferVolume = 0;

    for (const tx of transactions) {
        switch (tx.transactionClass) {
            case 'transfer':
                if (tx.type === 'expense') transferVolume += tx.amount;
                break;
            case 'salary':
                totalSalary += tx.amount;
                break;
            case 'spending':
                totalSpending += tx.amount;
                break;
            case 'income':
                totalIncome += tx.amount;
                break;
            case 'refund':
                totalSpending -= tx.amount; // Refunds reduce spending
                break;
            // atm, cc_payment - excluded from totals
        }
    }

    return {
        totalSpending: Math.max(0, totalSpending),
        totalIncome,
        totalSalary,
        transferVolume
    };
}
