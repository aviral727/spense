export const CATEGORY_RULES: Record<string, RegExp> = {
    'Ordered Food': /swiggy|zomato|eatclub|dominos|pizza|burger|kfc|mcdonalds|restaurant|cafe|dining|bistro|bakery|cake|starbucks|costa|subway/i,
    'Groceries': /blinkit|zepto|bigbasket|instamart|dmart|reliance\s*fresh|fruit|vegetable|mart|supermarket|kirana|grocery|milk|dairy|bakery/i,
    'Online Purchases': /amazon|flipkart|myntra|ajio|meesho|nykaa|tata\s*neu|snapdeal|shopify|lenskart|decathlon|purchase|order|delivery/i,
    'Subscriptions': /netflix|prime|hotstar|spotify|youtube|apple|google\s*one|chatgpt|subscription|membership|hulu|disney|hbo|cloud/i,
    'Fuel/Travel': /uber|ola|rapido|petrol|fuel|shell|indian\s*oil|hp|bharat\s*petroleum|toll|fastag|metro|irctc|rail|flight|ticket|travel|taxi|cab|auto/i,
    'Bills': /electricity|broadband|mobile|recharge|bill|utility|internet|wifi|water|gas|dth/i,
    'Health': /hospital|clinic|pharmacy|medicine|doctor|medical|health|test|lab|apollo|practo|1mg/i,
    'Entertainment': /bookmyshow|movie|cinema|pvr|inox|theatre|game|steam|playstation|xbox/i,
    'Salary': /salary|wages|income|payment\s+received|bonus|stipend|credit/i,
};

export function suggestCategory(text: string): string | null {
    const lowerText = text.toLowerCase();

    for (const [category, regex] of Object.entries(CATEGORY_RULES)) {
        if (regex.test(lowerText)) {
            return category;
        }
    }

    return 'Others';
}
