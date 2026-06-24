/**
 * Smart transaction categorization utility.
 *
 * Category IDs mirror the backend DEFAULT_CATEGORIES seed order exactly:
 *   1  Food           2  Groceries     3  Transport     4  Rent
 *   5  Utilities      6  Shopping      7  Entertainment 8  Healthcare
 *   9  Education     10  Investments   11  Subscriptions 12  Miscellaneous
 *  13  Income        14  Salary        15  Freelance     16  Business
 *  17  Other Income
 *
 * No API calls — runs purely client-side.
 */

export interface CategoryMeta {
  id: number;
  name: string;
  icon: string;
  color: string;
}

/** Static list that mirrors backend DEFAULT_CATEGORIES exactly. */
export const CATEGORIES: CategoryMeta[] = [
  { id: 1,  name: 'Food',           icon: '🍔', color: '#FF6B6B' },
  { id: 2,  name: 'Groceries',      icon: '🛒', color: '#4ECDC4' },
  { id: 3,  name: 'Transport',      icon: '🚗', color: '#45B7D1' },
  { id: 4,  name: 'Rent',           icon: '🏠', color: '#96CEB4' },
  { id: 5,  name: 'Utilities',      icon: '⚡', color: '#FFEAA7' },
  { id: 6,  name: 'Shopping',       icon: '🛍️',  color: '#DDA0DD' },
  { id: 7,  name: 'Entertainment',  icon: '🎬', color: '#98D8C8' },
  { id: 8,  name: 'Healthcare',     icon: '💊', color: '#F7DC6F' },
  { id: 9,  name: 'Education',      icon: '📚', color: '#85C1E9' },
  { id: 10, name: 'Investments',    icon: '📈', color: '#82E0AA' },
  { id: 11, name: 'Subscriptions',  icon: '🔄', color: '#F0B27A' },
  { id: 12, name: 'Miscellaneous',  icon: '📦', color: '#AEB6BF' },
  { id: 13, name: 'Income',         icon: '💰', color: '#2ECC71' },
  { id: 14, name: 'Salary',         icon: '💵', color: '#27AE60' },
  { id: 15, name: 'Freelance',      icon: '💻', color: '#1ABC9C' },
  { id: 16, name: 'Business',       icon: '🏢', color: '#3498DB' },
  { id: 17, name: 'Other Income',   icon: '💸', color: '#9B59B6' },
];

/** Lookup helper: get a CategoryMeta by id. */
export function getCategoryById(id: number | null | undefined): CategoryMeta | undefined {
  if (id == null) return undefined;
  return CATEGORIES.find((c) => c.id === id);
}

// ── Rule engine ───────────────────────────────────────────────────────────────

interface CategoryRule {
  id: number;
  keywords: string[];
}

/**
 * Ordered rules — more specific rules appear first so they win over
 * generic matches when multiple keywords could fire.
 */
const RULES: CategoryRule[] = [
  // Income-side (check before expense categories to avoid cross-match)
  { id: 14, keywords: ['salary', 'payroll', 'ctc'] },
  { id: 15, keywords: ['freelance', 'freelancing', 'upwork', 'fiverr', 'toptal'] },
  { id: 17, keywords: ['dividend', 'interest income', 'other income', 'bonus'] },
  { id: 16, keywords: ['business', 'revenue', 'consulting'] },
  { id: 13, keywords: ['income', 'earnings'] },

  // Investments
  { id: 10, keywords: ['stocks', 'mutual fund', 'sip', 'nps', 'zerodha', 'groww', 'kuvera', 'smallcase', 'investment', 'invest', 'shares', 'demat', 'ipo', 'equity', 'ppf', 'fd', 'fixed deposit'] },

  // Subscriptions (before Entertainment so netflix/spotify match here first)
  { id: 11, keywords: ['netflix', 'hotstar', 'disney', 'amazon prime', 'spotify', 'apple music', 'youtube premium', 'subscription', 'jiocinema', 'zee5', 'sonyliv', 'crunchyroll'] },

  // Food
  { id: 1, keywords: ['zomato', 'swiggy', 'restaurant', 'cafe', 'coffee', 'dine', 'pizza', 'burger', 'biryani', 'lunch', 'dinner', 'breakfast', 'food', 'eat', 'meal', 'bakery', 'hotel', 'dhaba', 'mess', 'canteen', 'starbucks', 'kfc', 'mcdonalds', "mcdonald's", 'dominos', "domino's", 'subway', 'chai', 'tea'] },

  // Groceries
  { id: 2, keywords: ['grocery', 'groceries', 'bigbasket', 'grofers', 'blinkit', 'zepto', 'dunzo', 'supermarket', 'vegetables', 'fruits', 'dmart', 'reliance fresh', 'more supermarket', 'nature basket', 'milk', 'dairy', 'provision'] },

  // Transport
  { id: 3, keywords: ['uber', 'ola', 'rapido', 'petrol', 'diesel', 'fuel', 'metro', 'bus', 'auto', 'cab', 'taxi', 'train', 'flight', 'airway', 'indigo', 'spicejet', 'air india', 'vistara', 'fastag', 'toll', 'parking', 'transport', 'travel', 'makemytrip', 'irctc', 'ixigo', 'goibibo'] },

  // Rent / Housing
  { id: 4, keywords: ['rent', 'rental', 'lease', 'pg', 'paying guest', 'hostel', 'housing', 'landlord', 'maintenance fee'] },

  // Utilities
  { id: 5, keywords: ['electricity', 'electric', 'bescom', 'tata power', 'adani electric', 'water bill', 'gas bill', 'lpg', 'cylinder', 'internet', 'broadband', 'airtel', 'jio', 'bsnl', 'vodafone', 'vi', 'recharge', 'mobile bill', 'utility', 'maintenance'] },

  // Shopping
  { id: 6, keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'snapdeal', 'nykaa', 'tatacliq', 'reliance digital', 'croma', 'shopping', 'purchase', 'buy', 'order', 'clothes', 'fashion', 'shoes', 'apparel', 'electronics'] },

  // Entertainment
  { id: 7, keywords: ['movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'gaming', 'game', 'ps5', 'xbox', 'steam', 'concert', 'event', 'entertainment', 'amusement', 'theme park', 'outing'] },

  // Healthcare
  { id: 8, keywords: ['hospital', 'clinic', 'doctor', 'medicine', 'pharmacy', 'apollo', 'fortis', 'max hospital', 'medplus', 'netmeds', '1mg', 'pharmeasy', 'diagnostic', 'lab test', 'scan', 'healthcare', 'medical', 'dental', 'optician', 'health'] },

  // Education
  { id: 9, keywords: ['school', 'college', 'university', 'course', 'tuition', 'coaching', 'udemy', 'coursera', 'skill', 'exam', 'fee', 'education', 'library', 'book', 'stationery'] },
];

/**
 * Detect a category from free-form description text.
 * Returns the CategoryMeta if a keyword matches, otherwise undefined.
 */
export function detectCategory(description: string): CategoryMeta | undefined {
  if (!description || description.trim().length < 2) return undefined;

  const lower = description.toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        return getCategoryById(rule.id);
      }
    }
  }

  return undefined;
}
