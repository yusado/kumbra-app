// Kumbra Type Definitions

// Markets
export type Market = 'BIST' | 'NASDAQ' | 'US' | 'FUND' | 'FX' | 'METAL' | 'CRYPTO' | 'CASH';
export type AssetType = 'stock' | 'fund' | 'fx' | 'metal' | 'crypto' | 'cash';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'fund_buy' | 'fund_sell' | 'commission' | 'cash_in' | 'cash_out';
export type PrivacyMode = 'visible_try' | 'visible_usd' | 'hidden';
export type Exchange = 'US' | 'BIST';

export type ExpenseCategory =
  | 'fuel' | 'groceries' | 'dining' | 'cafe' | 'transport' | 'utilities'
  | 'rent' | 'phone_internet' | 'health' | 'education' | 'clothing'
  | 'subscriptions' | 'installments' | 'credit_card' | 'debt_payment'
  | 'entertainment' | 'other';
export type IncomeCategory = 'salary' | 'bonus' | 'extra' | 'scholarship' | 'family' | 'sale' | 'other';
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'bank';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

// Database models
export interface Profile {
  id: string;
  display_name: string | null;
  base_currency: string;
  privacy_mode: PrivacyMode;
  created_at: string;
}

export interface Asset {
  id: string;
  session_id: string;
  ticker: string;
  name: string;
  exchange: Exchange;
  quantity: number;
  purchase_price: number;
  currency: string;
  created_at: string;
}

export interface AssetPrice {
  id: string;
  symbol: string;
  price: number;
  currency: string;
  change: number | null;
  change_percent: number | null;
  change_1w: number | null;
  timestamp: string;
  source: string;
  interval: string;
}

export interface QuoteData {
  price: number;
  name: string;
  currency: string;
  changePercent: number;
  change: number;
  timestamp?: string;
  source?: string;
}

export interface QuotesMap {
  [ticker: string]: QuoteData;
}

export interface Transaction {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: string;
  type: TransactionType;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  fee: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: Market;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  repeat_type: RepeatType;
  payment_method: PaymentMethod;
  note: string | null;
  created_at: string;
}

export interface IncomeRecord {
  id: string;
  user_id: string;
  category: IncomeCategory;
  amount: number;
  currency: string;
  date: string;
  repeat_type: RepeatType;
  note: string | null;
  created_at: string;
}

export interface Liability {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  monthly_payment: number;
  category: string;
  created_at: string;
}

export interface CashAccount {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  currency: string;
  account_type: 'cash' | 'bank' | 'credit_card';
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  pair: string;
  rate: number;
  timestamp: string;
  source: string;
}

export interface PortfolioSnapshot {
  id: string;
  session_id: string;
  total_value_usd: number;
  total_value_try: number;
  recorded_at: string;
}

// Computed/UI types
export interface AssetWithQuote extends Asset {
  currentPrice: number;
  currentValueUSD: number;
  currentValueTRY: number;
  purchaseValueUSD: number;
  profitLossUSD: number;
  profitLossPercent: number;
  changePercent: number;
  change1w?: number;
}

export interface PortfolioSummary {
  totalValueTRY: number;
  totalValueUSD: number;
  totalInvestedTRY: number;
  totalInvestedUSD: number;
  dailyPL: number;
  weeklyPL: number;
  monthlyPL: number;
  totalPL: number;
  totalPLPercent: number;
}

export interface NetWorth {
  total: number;
  cash: number;
  portfolio: number;
  assets: number;
  liabilities: number;
  change24h: number;
  changeMonthly: number;
}

export interface MarketSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  lastUpdate: string;
  isLive: boolean;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TimeRange {
  label: string;
  value: string;
  interval: string;
}

export const TIME_RANGES: TimeRange[] = [
  { label: '24 Saat', value: '1d', interval: '5m' },
  { label: '1 Hafta', value: '1w', interval: '1h' },
  { label: '1 Ay', value: '1m', interval: '1d' },
  { label: '6 Ay', value: '6m', interval: '1d' },
  { label: '1 Yıl', value: '1y', interval: '1w' },
  { label: '2 Yıl', value: '2y', interval: '1w' },
  { label: '5 Yıl', value: '5y', interval: '1w' },
];

// Form types
export interface NewAssetForm {
  ticker: string;
  exchange: Exchange;
  quantity: string;
  purchase_price: string;
}

export interface TransactionForm {
  symbol: string;
  assetName: string;
  market: Market;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  currency: string;
  fee: string;
  date: string;
  notes: string;
}

export interface ExpenseForm {
  category: ExpenseCategory;
  amount: string;
  currency: string;
  date: string;
  repeatType: RepeatType;
  paymentMethod: PaymentMethod;
  note: string;
}

export interface IncomeForm {
  category: IncomeCategory;
  amount: string;
  currency: string;
  date: string;
  repeatType: RepeatType;
  note: string;
}

// Expense category display names
export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: 'fuel', label: 'Yakıt' },
  { key: 'groceries', label: 'Market' },
  { key: 'dining', label: 'Dışarıda Yemek' },
  { key: 'cafe', label: 'Kafe' },
  { key: 'transport', label: 'Ulaşım' },
  { key: 'utilities', label: 'Faturalar' },
  { key: 'rent', label: 'Kira' },
  { key: 'phone_internet', label: 'Telefon/İnternet' },
  { key: 'health', label: 'Sağlık' },
  { key: 'education', label: 'Eğitim' },
  { key: 'clothing', label: 'Giyim' },
  { key: 'subscriptions', label: 'Abonelikler' },
  { key: 'installments', label: 'Taksitler' },
  { key: 'credit_card', label: 'Kredi Kartı' },
  { key: 'debt_payment', label: 'Borç Ödemesi' },
  { key: 'entertainment', label: 'Eğlence' },
  { key: 'other', label: 'Diğer' },
];

export const INCOME_CATEGORIES: { key: IncomeCategory; label: string }[] = [
  { key: 'salary', label: 'Maaş' },
  { key: 'bonus', label: 'Prim' },
  { key: 'extra', label: 'Ek Gelir' },
  { key: 'scholarship', label: 'Burs' },
  { key: 'family', label: 'Aile Desteği' },
  { key: 'sale', label: 'Satış Geliri' },
  { key: 'other', label: 'Diğer' },
];

// Popular assets for search
export const POPULAR_BIST = [
  { symbol: 'GARAN.IS', name: 'Garanti Bankası', market: 'BIST' as Market },
  { symbol: 'THYAO.IS', name: 'Türk Hava Yolları', market: 'BIST' as Market },
  { symbol: 'ASELS.IS', name: 'Aselsan', market: 'BIST' as Market },
  { symbol: 'EREGL.IS', name: 'Ereğli Demir Çelik', market: 'BIST' as Market },
  { symbol: 'BIMAS.IS', name: 'BİM Mağazalar', market: 'BIST' as Market },
  { symbol: 'SISE.IS', name: 'Şişe Cam', market: 'BIST' as Market },
  { symbol: 'AKBNK.IS', name: 'Akbank', market: 'BIST' as Market },
  { symbol: 'ISCTR.IS', name: 'İş Bankası C', market: 'BIST' as Market },
  { symbol: 'KCHOL.IS', name: 'Koç Holding', market: 'BIST' as Market },
  { symbol: 'TUPRS.IS', name: 'Tüpraş', market: 'BIST' as Market },
  { symbol: 'YKBNK.IS', name: 'Yapı Kredi', market: 'BIST' as Market },
  { symbol: 'TKFEN.IS', name: 'Tekfen', market: 'BIST' as Market },
];

export const POPULAR_US = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US' as Market },
  { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US' as Market },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US' as Market },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US' as Market },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US' as Market },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US' as Market },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US' as Market },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US' as Market },
  { symbol: 'V', name: 'Visa Inc.', market: 'US' as Market },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US' as Market },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', market: 'NASDAQ' as Market },
];

export const POPULAR_FX = [
  { symbol: 'USDTRY=X', name: 'ABD Doları / TL', market: 'FX' as Market },
  { symbol: 'EURTRY=X', name: 'Euro / TL', market: 'FX' as Market },
  { symbol: 'EURUSD=X', name: 'Euro / Dolar', market: 'FX' as Market },
];

export const POPULAR_METALS = [
  { symbol: 'GC=F', name: 'Altın Vadeli', market: 'METAL' as Market },
  { symbol: 'SI=F', name: 'Gümüş Vadeli', market: 'METAL' as Market },
];

export const POPULAR_FUNDS = [
  { symbol: 'A1', name: 'Ak Portföy Hisse Fon', market: 'FUND' as Market },
  { symbol: 'YKO', name: 'Yapı Kredi Portföy Fon', market: 'FUND' as Market },
  { symbol: 'ICI', name: 'İş Portföy Fon', market: 'FUND' as Market },
];

export const ALL_POPULAR = [...POPULAR_BIST, ...POPULAR_US, ...POPULAR_FX, ...POPULAR_METALS, ...POPULAR_FUNDS];
