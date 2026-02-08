import { suggestCategory } from './categoryRules';

export interface ParsedTransaction {
    amount: number;
    type: 'income' | 'expense';
    merchant?: string;
    category?: string;
    date: number;
    account?: string; // Last 4 digits
    rawMessage: string;
    upiRef?: string; // UPI Reference number for transfer matching
}

// Known sender IDs for Indian Banks & UPI
const KNOWN_SENDERS = [
    'HDFCBK', 'ICICIB', 'SBIIN', 'AXISBK', 'KOTAKB', 'PNBSMS', 'BOISMS',
    'PAYTM', 'PHONEPE', 'GPAY', 'AMAZON', 'BHART', 'MOBIKW', 'INDUSB',
    'UNIONB', 'CANARA', 'BOB', 'IDFCFB', 'YESBNK', 'RBL',
    'VM-', 'VK-', 'JD-', 'TX-', 'AD-', 'BP-', 'AM-' // Common carrier prefixes
];

// Keywords to identify transaction messages vs spam/OTPs
const TXN_KEYWORDS = [
    'debited', 'credited', 'spent', 'paid', 'sent', 'received', 'withdrawn',
    'deposited', 'purchase', 'spent', 'payment', 'transfer'
];

// Spam/OTP keywords to ignore
const IGNORE_KEYWORDS = [
    'otp', 'verification code', 'login', 'auth', 'balance', 'outstanding',
    'due', 'request', 'fail', 'declined', 'emi'
];

export function isTransactionSMS(address: string, body: string): boolean {
    const addressUpper = address.toUpperCase();
    const bodyLower = body.toLowerCase();

    // 1. Sender Check
    const isKnownSender = KNOWN_SENDERS.some(sender => addressUpper.includes(sender));
    if (!isKnownSender) return false;

    // 2. Keyword Check
    const hasTxnKeyword = TXN_KEYWORDS.some(kw => bodyLower.includes(kw));
    if (!hasTxnKeyword) return false;

    // 3. Ignore Check
    const hasIgnoreKeyword = IGNORE_KEYWORDS.some(kw => bodyLower.includes(kw));
    if (hasIgnoreKeyword) return false;

    // 4. Amount Check (Crucial)
    const hasAmount = /(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?/i.test(body);

    return hasAmount;
}

export function parseSMSTransaction(body: string, date: number): ParsedTransaction | null {
    try {
        const cleanBody = body.replace(/\r?\n|\r/g, ' '); // Remove newlines

        // --- 1. AMOUNT EXTRACTION ---
        // Matches: Rs. 1,234.50, INR 500, Rs 500.00
        const amountMatch = cleanBody.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (!amountMatch) return null;

        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (isNaN(amount) || amount === 0) return null;

        // --- 2. DETERMINING TYPE (Debit/Credit) ---
        // Default to null, strictly look for keywords
        let type: 'income' | 'expense' | null = null;

        const debitKeywords = ['debited', 'spent', 'paid', 'sent', 'purchase', 'withdrawn', 'deducted'];
        const creditKeywords = ['credited', 'received', 'deposited', 'refund', 'added'];

        const lowerBody = cleanBody.toLowerCase();

        if (debitKeywords.some(kw => lowerBody.includes(kw))) {
            type = 'expense';
        } else if (creditKeywords.some(kw => lowerBody.includes(kw))) {
            type = 'income';
        }

        // If generic "transaction" word, fallback to "expense" if unsure, but better to skip if ambiguous
        if (!type) return null;

        // --- 3. EXTRACTING MERCHANT / DESCRIPTION ---
        const merchant = extractMerchant(cleanBody, type);

        // --- 4. EXTRACT ACCOUNT (Optional) ---
        // Matches: a/c X1234, card XX1234, ends with 1234
        const accountMatch = cleanBody.match(/(?:a\/c|card|account|ending|no\.|xx+)\s*([0-9xX]*\d{4})/i);
        const account = accountMatch ? accountMatch[1].slice(-4) : undefined;

        // --- 5. EXTRACT UPI REFERENCE NUMBER ---
        const upiRef = extractUPIRef(cleanBody);

        // --- 6. CATEGORIZATION ---
        const category = suggestCategory(merchant + ' ' + cleanBody) || 'Others';

        return {
            amount,
            type,
            merchant: merchant || 'Unknown',
            category,
            date,
            account,
            rawMessage: body,
            upiRef
        };

    } catch (error) {
        console.error('Error parsing SMS:', error);
        return null;
    }
}

/**
 * Extract UPI Reference Number from SMS body
 * Matches patterns like: Ref 190332417220, UPI Ref No 123456789012, UTR: 123456789012
 */
function extractUPIRef(body: string): string | undefined {
    // Pattern 1: "Ref 190332417220" or "Ref No 190332417220"
    const refMatch = body.match(/\bRef(?:\s*No\.?)?\s*[:.]?\s*(\d{9,20})/i);
    if (refMatch) return refMatch[1];

    // Pattern 2: "UPI Ref No 190332417220"
    const upiRefMatch = body.match(/UPI\s*Ref\s*(?:No\.?)?\s*[:.]?\s*(\d{9,20})/i);
    if (upiRefMatch) return upiRefMatch[1];

    // Pattern 3: "UTR: 123456789012" or "UTR 123456789012"
    const utrMatch = body.match(/UTR\s*[:.]?\s*(\d{9,20})/i);
    if (utrMatch) return utrMatch[1];

    // Pattern 4: "by UPI Ref No 190332417220"
    const byRefMatch = body.match(/by\s*UPI\s*Ref\s*No\s*[:.]?\s*(\d{9,20})/i);
    if (byRefMatch) return byRefMatch[1];

    return undefined;
}

function extractMerchant(body: string, type: 'income' | 'expense'): string {
    // Regex strategies for Merchant Name

    // Strategy 1: "At [Merchant]"
    const atMatch = body.match(/\bat\s+([A-Z0-9\s&*-]+?)(?:\s+(?:on|dated|via|through|using)\b|\.|$)/i);
    if (atMatch && atMatch[1].length > 2) return cleanMerchantName(atMatch[1]);

    // Strategy 2: "To [Merchant]" (Mainly for UPI/Transfers)
    const toMatch = body.match(/\bto\s+([A-Z0-9\s&*-]+?)(?:\s+(?:on|dated|via|through|ref)\b|\.|$)/i);
    if (toMatch && toMatch[1].length > 2) return cleanMerchantName(toMatch[1]);

    // Strategy 3: "From [Sender]" (For Credits)
    if (type === 'income') {
        const fromMatch = body.match(/\bfrom\s+([A-Z0-9\s&*-]+?)(?:\s+(?:on|dated|via|through|ref)\b|\.|$)/i);
        if (fromMatch && fromMatch[1].length > 2) return cleanMerchantName(fromMatch[1]);
    }

    // Strategy 4: VPA/UPI ID (e.g., uber@okaxis)
    const vpaMatch = body.match(/([a-zA-Z0-9.-]+@[a-zA-Z]+)/);
    if (vpaMatch) {
        return cleanMerchantName(vpaMatch[1].split('@')[0]);
    }

    // Strategy 5: "Info: [Merchant]" (Specific to some gateways)
    const infoMatch = body.match(/Info:\s*([A-Z0-9\s&*-]+?)(?:\.|$)/i);
    if (infoMatch) return cleanMerchantName(infoMatch[1]);

    return type === 'income' ? 'Received Payment' : 'Purchase';
}

function cleanMerchantName(raw: string): string {
    return raw
        .replace(/^(vp|upi|imp|neft|rtgs|mbs|mmt)\s*[-/]?\s*/i, '') // Remove prefixes
        .replace(/\s+/g, ' ') // Collapse spaces
        .trim();
}

export function deduplicateTransactions(
    newTransactions: ParsedTransaction[],
    existingTransactions: any[]
): ParsedTransaction[] {
    return newTransactions.filter(newTx => {
        const isDuplicate = existingTransactions.some(existing => {
            // Fuzzy match: Same amount, Same Type, roughly same time (allow 5 min drift)
            const amountMatch = Math.abs(existing.amount - newTx.amount) < 1.0;
            const typeMatch = existing.type === newTx.type;
            const timeDiff = Math.abs(existing.date - newTx.date);
            const dateMatch = timeDiff < (5 * 60 * 1000); // 5 minutes

            return amountMatch && typeMatch && dateMatch;
        });

        return !isDuplicate;
    });
}
