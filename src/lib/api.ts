import { supabase, getSessionId, getDataOwnerId, getAuthenticatedUserId, hasSupabaseConfig } from './supabase';
import type {
  Asset,
  AssetWithQuote,
  QuoteData,
  QuotesMap,
  NewAssetForm,
  PortfolioSnapshot,
  Transaction,
  WatchlistItem,
  Expense,
  IncomeRecord,
  Liability,
  CashAccount,
  ExchangeRate,
  Market,
  TransactionType,
  ExpenseCategory,
  IncomeCategory,
} from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ============================================
// LOCAL FALLBACK STORAGE
// ============================================
// The app currently uses a browser session id instead of Supabase Auth.
// If Supabase RLS/FK policies reject writes, these helpers keep the app usable
// by saving critical personal data locally in the browser.

type LocalTable = 'watchlist' | 'expenses' | 'income' | 'assets' | 'transactions' | 'liabilities' | 'cash_accounts' | 'snapshots';

function localKey(table: LocalTable): string {
  return `kumbra_${table}_${getDataOwnerId()}`;
}

function readLocal<T>(table: LocalTable): T[] {
  try {
    const raw = localStorage.getItem(localKey(table));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch (err) {
    console.warn(`Local ${table} read failed`, err);
    return [];
  }
}

function writeLocal<T>(table: LocalTable, rows: T[]): void {
  try {
    localStorage.setItem(localKey(table), JSON.stringify(rows));
  } catch (err) {
    console.warn(`Local ${table} write failed`, err);
  }
}

function isCloudAccountMode(): boolean {
  return hasSupabaseConfig() && Boolean(getAuthenticatedUserId());
}

function shouldUseLocalFallback(): boolean {
  return !isCloudAccountMode();
}

function cloudAccountError(table: string, error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || `${table} kaydı yapılamadı`);
  }
  return `${table} kaydı yapılamadı`;
}

function localKeyForOwner(table: LocalTable, ownerId: string): string {
  return `kumbra_${table}_${ownerId}`;
}

function readLocalForOwner<T>(table: LocalTable, ownerId: string): T[] {
  try {
    const raw = localStorage.getItem(localKeyForOwner(table, ownerId));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch (err) {
    console.warn(`Local ${table} read failed for owner`, ownerId, err);
    return [];
  }
}

function getLocalOwnerCandidates(): string[] {
  return Array.from(new Set([getSessionId(), getDataOwnerId(), getAuthenticatedUserId() || ''].filter(Boolean)));
}

function readLocalCandidates<T extends { id?: string; symbol?: string; ticker?: string }>(table: LocalTable): T[] {
  const rows = getLocalOwnerCandidates().flatMap(ownerId => readLocalForOwner<T>(table, ownerId));
  const map = new Map<string, T>();
  rows.forEach((item, index) => {
    const key = item.id || item.symbol || item.ticker || `${table}_${index}_${JSON.stringify(item)}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function clearLocalCandidates(table: LocalTable): void {
  getLocalOwnerCandidates().forEach(ownerId => {
    try {
      localStorage.removeItem(localKeyForOwner(table, ownerId));
    } catch (err) {
      console.warn(`Local ${table} clear failed for owner`, ownerId, err);
    }
  });
}

function hasMigratedDemoData(userId: string): boolean {
  return localStorage.getItem(`kumbra_migrated_to_supabase_${userId}`) === 'true';
}

function markMigratedDemoData(userId: string): void {
  localStorage.setItem(`kumbra_migrated_to_supabase_${userId}`, 'true');
}

export function getDemoDataCounts(): { total: number; expenses: number; income: number; watchlist: number; transactions: number; liabilities: number; cashAccounts: number; assets: number } {
  const expenses = readLocalCandidates<Expense>('expenses').length;
  const income = readLocalCandidates<IncomeRecord>('income').length;
  const watchlist = readLocalCandidates<WatchlistItem>('watchlist').length;
  const transactions = readLocalCandidates<Transaction>('transactions').length;
  const liabilities = readLocalCandidates<Liability>('liabilities').length;
  const cashAccounts = readLocalCandidates<CashAccount>('cash_accounts').length;
  const assets = readLocalCandidates<Asset>('assets').length;
  return { total: expenses + income + watchlist + transactions + liabilities + cashAccounts + assets, expenses, income, watchlist, transactions, liabilities, cashAccounts, assets };
}

async function insertRowsSafely<T extends Record<string, any>>(table: string, rows: T[]): Promise<number> {
  if (!hasSupabaseConfig() || rows.length === 0) return 0;

  const cleaned = rows.map(({ id, created_at, ...rest }) => ({ ...rest }));
  const unique = new Map<string, Record<string, any>>();

  cleaned.forEach((row, index) => {
    let key = `${table}_${index}_${JSON.stringify(row)}`;
    if (table === 'watchlist') key = `${row.user_id}_${row.symbol}`;
    if (table === 'settings') key = `${row.user_id}_${row.key}`;
    if (table === 'assets') key = `${row.session_id}_${row.ticker}_${row.exchange}_${row.quantity}_${row.purchase_price}`;
    unique.set(key, row);
  });

  const payload = Array.from(unique.values());
  let query = supabase.from(table);
  const { error } = table === 'watchlist'
    ? await query.upsert(payload, { onConflict: 'user_id,symbol' })
    : table === 'settings'
      ? await query.upsert(payload, { onConflict: 'user_id,key' })
      : await query.insert(payload);

  if (error) {
    console.warn(`Demo data migration failed for ${table}:`, error.message);
    throw new Error(`${table}: ${error.message}`);
  }
  return payload.length;
}

export async function migrateDemoDataToSupabaseAccount(userId: string): Promise<{ success: boolean; migrated: number; skipped: boolean; error?: string }> {
  if (!hasSupabaseConfig()) return { success: false, migrated: 0, skipped: true, error: 'Supabase ayarlı değil' };
  if (!userId) return { success: false, migrated: 0, skipped: true, error: 'Kullanıcı bulunamadı' };
  const counts = getDemoDataCounts();
  if (hasMigratedDemoData(userId) && counts.total === 0) return { success: true, migrated: 0, skipped: true };

  const owners = getLocalOwnerCandidates();
  if (counts.total === 0) {
    markMigratedDemoData(userId);
    return { success: true, migrated: 0, skipped: true };
  }

  const collect = <T,>(table: LocalTable): T[] => owners.flatMap(ownerId => readLocalForOwner<T>(table, ownerId));

  try {
    await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: 'Kumbra Kullanıcısı', base_currency: 'TRY', privacy_mode: 'visible_try' }, { onConflict: 'id' });

    const expenses = collect<Expense>('expenses').map(row => ({ ...row, user_id: userId }));
    const income = collect<IncomeRecord>('income').map(row => ({ ...row, user_id: userId }));
    const watchlist = collect<WatchlistItem>('watchlist').map(row => ({ ...row, user_id: userId }));
    const transactions = collect<Transaction>('transactions').map(row => ({ ...row, user_id: userId }));
    const liabilities = collect<Liability>('liabilities').map(row => ({ ...row, user_id: userId }));
    const cashAccounts = collect<CashAccount>('cash_accounts').map(row => ({ ...row, user_id: userId }));
    const assets = collect<Asset>('assets').map(row => ({ ...row, session_id: userId }));

    let migrated = 0;
    migrated += await insertRowsSafely('expenses', expenses as any[]);
    migrated += await insertRowsSafely('income', income as any[]);
    migrated += await insertRowsSafely('watchlist', watchlist as any[]);
    migrated += await insertRowsSafely('transactions', transactions as any[]);
    migrated += await insertRowsSafely('liabilities', liabilities as any[]);
    migrated += await insertRowsSafely('cash_accounts', cashAccounts as any[]);
    migrated += await insertRowsSafely('assets', assets as any[]);

    if (migrated > 0) {
      (['expenses', 'income', 'watchlist', 'transactions', 'liabilities', 'cash_accounts', 'assets'] as LocalTable[]).forEach(clearLocalCandidates);
    }
    markMigratedDemoData(userId);
    return { success: true, migrated, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen aktarım hatası';
    console.warn('Demo data migration failed:', err);
    return { success: false, migrated: 0, skipped: false, error: message };
  }
}

function mergeByIdOrSymbol<T extends { id?: string; symbol?: string; ticker?: string }>(remote: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  [...local, ...remote].forEach((item) => {
    const key = item.id || item.symbol || item.ticker || JSON.stringify(item);
    map.set(key, item);
  });
  return Array.from(map.values());
}

function mergeAssets(remote: Asset[], local: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  [...local, ...remote].forEach((item) => {
    const key = item.id || `${item.ticker}_${item.exchange}_${item.quantity}_${item.purchase_price}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

async function ensureSessionProfile(): Promise<void> {
  if (!hasSupabaseConfig()) return;
  const id = getDataOwnerId();
  try {
    await supabase
      .from('profiles')
      .upsert({ id, display_name: 'Kumbra Kullanıcısı', base_currency: 'TRY', privacy_mode: 'visible_try' }, { onConflict: 'id' });
  } catch (err) {
    // This is intentionally non-fatal because local fallback will take over.
    console.warn('ensureSessionProfile failed; local fallback may be used', err);
  }
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}


// ============================================
// QUOTES & MARKET DATA - Yahoo Finance via Edge Function
// ============================================

export async function fetchQuotes(symbols: string[]): Promise<QuotesMap> {
  const cleanSymbols = [...new Set(symbols.map(s => String(s).trim()).filter(Boolean))];
  if (cleanSymbols.length === 0) return {};

  // 1) Production path: Vercel Serverless Function.
  // Keeps Twelve Data API key and BIST Google Apps Script URL out of the browser.
  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: cleanSymbols }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const raw = await res.json();
      const debug = raw?.__debug;
      if (debug) {
        console.info('Live quotes debug:', debug);
      }
      const { __debug, ...cleanData } = raw || {};
      const data = cleanData as QuotesMap;
      if (data && Object.keys(data).length > 0) {
        void Promise.allSettled(
          Object.entries(data).map(([symbol, quote]) =>
            quote?.price ? savePriceSnapshot(symbol, quote.price, quote.source || 'live') : Promise.resolve()
          )
        );
        return data;
      }
      if (debug) console.warn('Live quote API returned no quotes:', debug);
    } else {
      const text = await res.text().catch(() => '');
      console.warn('Live quote API failed:', res.status, text.slice(0, 300));
    }
  } catch (err) {
    // Local Vite dev server does not serve /api functions. This fallback is expected locally.
    console.info('Vercel quotes API unavailable, trying fallback providers.', err);
  }

  // 2) Backward compatibility: Supabase Edge Function if user deploys it.
  if (hasSupabaseConfig()) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-quotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols: cleanSymbols }),
      });

      if (res.ok) {
        const data = (await res.json()) as QuotesMap;
        if (data && Object.keys(data).length > 0) return data;
      }
      console.warn('Supabase quote fetch failed:', res.status);
    } catch (err) {
      console.warn('Supabase fetchQuotes error:', err);
    }
  }

  // 3) Development/demo fallback.
  return getMockQuotes(cleanSymbols);
}

// Mock fallback for when API fails
function getMockQuotes(symbols: string[]): QuotesMap {
  const mockData: Record<string, QuoteData> = {
    'USDTRY=X': { price: 45.50, name: 'USD/TRY', currency: 'TRY', changePercent: 0.15, change: 0.07 },
    'EURTRY=X': { price: 49.20, name: 'EUR/TRY', currency: 'TRY', changePercent: 0.22, change: 0.11 },
    'GC=F': { price: 2350, name: 'Altın', currency: 'USD', changePercent: 0.45, change: 10.5 },
    'SI=F': { price: 29.50, name: 'Gümüş', currency: 'USD', changePercent: -0.32, change: -0.09 },
    'SPY': { price: 530, name: 'S&P 500 ETF', currency: 'USD', changePercent: 0.65, change: 3.42 },
    'QQQ': { price: 460, name: 'NASDAQ QQQ', currency: 'USD', changePercent: 1.05, change: 4.78 },
    'AAPL': { price: 210, name: 'Apple Inc.', currency: 'USD', changePercent: 1.25, change: 2.59 },
    'MSFT': { price: 415, name: 'Microsoft', currency: 'USD', changePercent: 0.85, change: 3.50 },
    'NVDA': { price: 880, name: 'NVIDIA', currency: 'USD', changePercent: 2.15, change: 18.50 },
    'GARAN.IS': { price: 125.80, name: 'Garanti Bankası', currency: 'TRY', changePercent: 1.20, change: 1.49 },
    'THYAO.IS': { price: 295, name: 'Türk Hava Yolları', currency: 'TRY', changePercent: 0.75, change: 2.19 },
    'ASELS.IS': { price: 78.50, name: 'Aselsan', currency: 'TRY', changePercent: -0.45, change: -0.35 },
    'XU100.IS': { price: 10250, name: 'BIST 100', currency: 'TRY', changePercent: 0.92, change: 93.50 },
  };

  const result: QuotesMap = {};
  for (const sym of symbols) {
    if (mockData[sym]) result[sym] = mockData[sym];
  }
  return result;
}

export interface HistoryPoint {
  date: string;
  close: number;
}

export async function fetchHistory(symbol: string, range: string = '1y'): Promise<HistoryPoint[]> {
  const normalizedSymbol = String(symbol || '').trim();
  if (!normalizedSymbol) return [];

  // 1) Production path: Vercel Serverless Function.
  try {
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(normalizedSymbol)}&range=${encodeURIComponent(range)}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((p: any) => ({
          date: String(p.date).slice(0, range === '1d' || range === '1w' ? 16 : 10),
          close: Number(p.close),
          volume: p.volume ? Number(p.volume) : undefined,
        })).filter((p: HistoryPoint) => Number.isFinite(p.close) && p.close > 0);
      }
    }
  } catch {
    // Local Vite dev server does not serve /api functions. This fallback is expected locally.
  }

  // 2) Backward compatibility: Supabase Edge Function.
  if (hasSupabaseConfig()) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/fetch-quotes/history?symbol=${encodeURIComponent(normalizedSymbol)}&range=${encodeURIComponent(range)}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}
  }

  // 3) Fallback: locally stored snapshots in Supabase.
  if (hasSupabaseConfig()) {
    try {
      const { data, error } = await supabase
        .from('asset_prices')
        .select('timestamp, price')
        .eq('symbol', normalizedSymbol)
        .order('timestamp', { ascending: true })
        .limit(2000);

      if (!error && data && data.length > 0) {
        const now = new Date();
        const rangeDays: Record<string, number> = {
          '1d': 1, '1w': 7, '1m': 30, '6m': 180, '1y': 365, '2y': 730, '5y': 1825
        };
        const days = rangeDays[range] || 365;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const rows = data as { timestamp: string; price: number }[];
        return rows
          .filter((p) => new Date(p.timestamp) >= cutoff)
          .map((p) => ({ date: new Date(p.timestamp).toISOString().slice(0, 10), close: Number(p.price) }))
          .filter((p) => Number.isFinite(p.close) && p.close > 0);
      }
    } catch {}
  }

  return [];
}

// Save price snapshot to database for historical tracking
export async function savePriceSnapshot(symbol: string, price: number, source: string = 'api'): Promise<void> {
  if (!hasSupabaseConfig()) return;
  try {
    await supabase.from('asset_prices').insert({
      symbol,
      price,
      currency: symbol.includes('TRY') ? 'TRY' : symbol.includes('.IS') ? 'TRY' : 'USD',
      change: 0,
      change_percent: 0,
      timestamp: new Date().toISOString(),
      source,
      interval: '1d',
    });
  } catch {
    // Ignore duplicate errors
  }
}

// ============================================
// ASSETS (Simple portfolio - existing table)
// ============================================

export async function loadAssets(): Promise<Asset[]> {
  const sessionId = getDataOwnerId();
  const local = readLocalCandidates<Asset>('assets');
  if (shouldUseLocalFallback()) return local;

  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('loadAssets Supabase failed:', error.message);
      return local;
    }
    return mergeAssets((data as Asset[]) ?? [], local);
  } catch (err) {
    console.warn('loadAssets failed:', err);
    return local;
  }
}

export async function addAsset(form: NewAssetForm, resolvedName: string): Promise<Asset> {
  const sessionId = getDataOwnerId();
  const currency = form.exchange === 'BIST' ? 'TRY' : 'USD';
  const payload = {
    id: makeLocalId('asset'),
    session_id: sessionId,
    ticker: form.ticker.toUpperCase().trim(),
    name: resolvedName,
    exchange: form.exchange,
    quantity: parseFloat(form.quantity),
    purchase_price: parseFloat(form.purchase_price),
    currency,
    created_at: new Date().toISOString(),
  } as Asset;

  if (isCloudAccountMode()) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .insert({
          session_id: payload.session_id,
          ticker: payload.ticker,
          name: payload.name,
          exchange: payload.exchange,
          quantity: payload.quantity,
          purchase_price: payload.purchase_price,
          currency: payload.currency,
        })
        .select()
        .single();

      if (!error && data) return data as Asset;
      console.warn('addAsset Supabase failed:', error?.message);
      throw new Error(cloudAccountError('Portföy varlığı', error));
    } catch (err) {
      console.warn('addAsset failed:', err);
      throw new Error(cloudAccountError('Portföy varlığı', err));
    }
  }

  writeLocal('assets', [payload, ...readLocal<Asset>('assets')]);
  return payload;
}

export async function deleteAsset(id: string): Promise<void> {
  writeLocal('assets', readLocal<Asset>('assets').filter(item => item.id !== id));
  if (!hasSupabaseConfig() || id.startsWith('asset_')) return;
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) console.warn('deleteAsset Supabase failed:', error.message);
}

export async function saveSnapshot(totalValueUsd: number, totalValueTry: number): Promise<void> {
  const sessionId = getDataOwnerId();
  const snapshot: PortfolioSnapshot = {
    id: makeLocalId('snapshot'),
    session_id: sessionId,
    total_value_usd: totalValueUsd,
    total_value_try: totalValueTry,
    recorded_at: new Date().toISOString(),
  } as PortfolioSnapshot;

  if (shouldUseLocalFallback()) {
    writeLocal('snapshots', [...readLocal<PortfolioSnapshot>('snapshots'), snapshot]);
    return;
  }

  try {
    await supabase.from('portfolio_snapshots').insert({
      session_id: sessionId,
      total_value_usd: totalValueUsd,
      total_value_try: totalValueTry,
    });
  } catch (err) {
    console.warn('saveSnapshot Supabase failed, saving locally:', err);
    writeLocal('snapshots', [...readLocal<PortfolioSnapshot>('snapshots'), snapshot]);
  }
}

export async function loadSnapshots(): Promise<PortfolioSnapshot[]> {
  const sessionId = getDataOwnerId();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const local = readLocal<PortfolioSnapshot>('snapshots');
  if (shouldUseLocalFallback()) return local;

  try {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('session_id', sessionId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.warn('loadSnapshots Supabase failed:', error.message);
      return [];
    }
    return (data as PortfolioSnapshot[]) ?? [];
  } catch (err) {
    console.warn('loadSnapshots failed:', err);
    return [];
  }
}

// ============================================
// TRANSACTIONS (Advanced portfolio)
// ============================================

export async function loadTransactions(): Promise<Transaction[]> {
  const userId = getDataOwnerId();
  const local = readLocalCandidates<Transaction>('transactions');
  if (shouldUseLocalFallback()) return local;
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.warn('loadTransactions Supabase failed:', error.message);
      return local;
    }
    return mergeByIdOrSymbol((data as Transaction[]) ?? [], local);
  } catch (err) {
    console.warn('loadTransactions failed:', err);
    return local;
  }
}

export async function addTransaction(tx: {
  symbol: string;
  assetName: string;
  market: Market;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  currency: string;
  fee?: number;
  date: string;
  notes?: string;
}): Promise<Transaction> {
  const userId = getDataOwnerId();
  const totalAmount = tx.quantity * tx.unitPrice;
  const payload = {
    id: makeLocalId('transaction'),
    user_id: userId,
    symbol: tx.symbol,
    asset_name: tx.assetName,
    market: tx.market,
    type: tx.type,
    quantity: tx.quantity,
    unit_price: tx.unitPrice,
    total_amount: totalAmount,
    currency: tx.currency,
    fee: tx.fee || 0,
    transaction_date: tx.date,
    notes: tx.notes || null,
    created_at: new Date().toISOString(),
  } as Transaction;

  if (isCloudAccountMode()) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single();

      if (!error && data) return data as Transaction;
      console.warn('addTransaction Supabase failed:', error?.message);
      throw new Error(cloudAccountError('Portföy işlemi', error));
    } catch (err) {
      console.warn('addTransaction failed:', err);
      throw new Error(cloudAccountError('Portföy işlemi', err));
    }
  }

  writeLocal('transactions', [payload, ...readLocal<Transaction>('transactions')]);
  return payload;
}

export async function deleteTransaction(id: string): Promise<void> {
  writeLocal('transactions', readLocal<Transaction>('transactions').filter(item => item.id !== id));
  if (!hasSupabaseConfig() || id.startsWith('transaction_')) return;
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) console.warn('deleteTransaction Supabase failed:', error.message);
}

// Compute holdings from transactions
export function computeHoldingsFromTransactions(
  transactions: Transaction[],
  quotes: QuotesMap
): AssetWithQuote[] {
  const holdings: Map<string, {
    symbol: string;
    name: string;
    market: Market;
    currency: string;
    quantity: number;
    totalCost: number;
    realizedPL: number;
  }> = new Map();

  for (const tx of transactions) {
    const key = tx.symbol;
    let h = holdings.get(key);

    if (!h) {
      h = {
        symbol: tx.symbol,
        name: tx.asset_name || tx.symbol,
        market: tx.market as Market,
        currency: tx.currency,
        quantity: 0,
        totalCost: 0,
        realizedPL: 0,
      };
      holdings.set(key, h);
    }

    const qty = tx.quantity;
    const price = tx.unit_price;
    const fee = tx.fee || 0;

    if (tx.type === 'buy' || tx.type === 'fund_buy') {
      h.quantity += qty;
      h.totalCost += qty * price + fee;
    } else if (tx.type === 'sell' || tx.type === 'fund_sell') {
      if (h.quantity > 0) {
        const avgCost = h.totalCost / h.quantity;
        const costBasis = qty * avgCost;
        h.realizedPL += qty * price - costBasis - fee;
        h.quantity -= qty;
        h.totalCost = h.quantity * avgCost;
      }
    } else if (tx.type === 'dividend') {
      h.realizedPL += qty * price - fee;
    }
  }

  const results: AssetWithQuote[] = [];
  for (const [, h] of holdings) {
    if (h.quantity <= 0) continue;

    const quote = quotes[h.symbol];
    const price = quote?.price || 0;
    const avgCost = h.totalCost / h.quantity;
    const currentValue = h.quantity * price;
    const investedValue = h.totalCost;
    const unrealizedPL = currentValue - investedValue;

    results.push({
      id: h.symbol,
      session_id: '',
      ticker: h.symbol.replace('.IS', ''),
      name: h.name,
      exchange: h.market === 'BIST' ? 'BIST' : 'US',
      quantity: h.quantity,
      purchase_price: avgCost,
      currency: h.currency,
      created_at: '',
      currentPrice: price,
      currentValueUSD: h.currency === 'USD' ? currentValue : currentValue / 45.5,
      currentValueTRY: h.currency === 'TRY' ? currentValue : currentValue * 45.5,
      purchaseValueUSD: h.currency === 'USD' ? investedValue : investedValue / 45.5,
      profitLossUSD: unrealizedPL,
      profitLossPercent: investedValue > 0 ? (unrealizedPL / investedValue) * 100 : 0,
      changePercent: quote?.changePercent || 0,
    });
  }

  return results;
}

// ============================================
// WATCHLIST
// ============================================

export async function loadWatchlist(): Promise<WatchlistItem[]> {
  const userId = getDataOwnerId();
  const local = readLocalCandidates<WatchlistItem>('watchlist');

  if (shouldUseLocalFallback()) return local;

  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('loadWatchlist Supabase failed:', error.message);
      return local;
    }

    return mergeByIdOrSymbol((data as WatchlistItem[]) ?? [], local);
  } catch (err) {
    console.warn('loadWatchlist failed:', err);
    return local;
  }
}

export async function addToWatchlist(symbol: string, name: string, market: Market): Promise<{ success: boolean; error?: string }> {
  const userId = getDataOwnerId();
  const normalizedSymbol = symbol.toUpperCase().trim();
  const local = readLocal<WatchlistItem>('watchlist');

  if (shouldUseLocalFallback() && local.some(item => item.symbol === normalizedSymbol)) {
    return { success: true };
  }

  if (isCloudAccountMode()) {
    try {
      await ensureSessionProfile();
      const { error } = await supabase
        .from('watchlist')
        .upsert({
          user_id: userId,
          symbol: normalizedSymbol,
          asset_name: name,
          market,
        }, { onConflict: 'user_id,symbol' });

      if (!error) return { success: true };
      console.warn('addToWatchlist Supabase failed:', error.message);
      return { success: false, error: cloudAccountError('Takip listesi', error) };
    } catch (err) {
      console.warn('addToWatchlist failed:', err);
      return { success: false, error: cloudAccountError('Takip listesi', err) };
    }
  }

  const item: WatchlistItem = {
    id: makeLocalId('watchlist'),
    user_id: userId,
    symbol: normalizedSymbol,
    asset_name: name,
    market,
    created_at: new Date().toISOString(),
  };
  writeLocal('watchlist', [item, ...local]);
  return { success: true };
}

export async function removeFromWatchlist(symbol: string): Promise<{ success: boolean; error?: string }> {
  const userId = getDataOwnerId();
  const normalizedSymbol = symbol.toUpperCase().trim();
  const local = readLocal<WatchlistItem>('watchlist').filter(item => item.symbol !== normalizedSymbol);
  writeLocal('watchlist', local);

  if (hasSupabaseConfig()) {
    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('symbol', normalizedSymbol);

      if (error) {
        console.warn('removeFromWatchlist Supabase failed, removed locally:', error.message);
      }
    } catch (err) {
      console.warn('removeFromWatchlist failed, removed locally:', err);
    }
  }

  return { success: true };
}

export async function isWatched(symbol: string): Promise<boolean> {
  const userId = getDataOwnerId();
  const normalizedSymbol = symbol.toUpperCase().trim();
  const local = readLocal<WatchlistItem>('watchlist');
  if (shouldUseLocalFallback()) return local.some(item => item.symbol === normalizedSymbol);


  try {
    const { count, error } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('symbol', normalizedSymbol);

    if (error) {
      console.warn('isWatched Supabase failed:', error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ============================================
// EXPENSES
// ============================================

export async function loadExpenses(startDate?: Date, endDate?: Date): Promise<Expense[]> {
  const userId = getDataOwnerId();
  const local = readLocalCandidates<Expense>('expenses');

  if (shouldUseLocalFallback()) return local;

  try {
    let query = supabase.from('expenses').select('*').eq('user_id', userId);

    if (startDate) query = query.gte('date', startDate.toISOString().split('T')[0]);
    if (endDate) query = query.lte('date', endDate.toISOString().split('T')[0]);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) {
      console.warn('loadExpenses Supabase failed:', error.message);
      return local;
    }
    return mergeByIdOrSymbol((data as Expense[]) ?? [], local);
  } catch (err) {
    console.warn('loadExpenses failed:', err);
    return local;
  }
}

export async function addExpense(e: {
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  repeatType?: string;
  paymentMethod?: string;
  note?: string;
}): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const userId = getDataOwnerId();
  const amount = Number(e.amount);

  if (!e.category) return { success: false, error: 'Kategori seçilmedi' };
  if (!isValidAmount(amount)) return { success: false, error: 'Tutar geçerli değil' };

  const payload = {
    user_id: userId,
    category: e.category,
    amount,
    currency: e.currency || 'TRY',
    date: e.date || new Date().toISOString().slice(0, 10),
    repeat_type: e.repeatType || 'none',
    payment_method: e.paymentMethod || 'cash',
    note: e.note || null,
  };

  if (isCloudAccountMode()) {
    try {
      await ensureSessionProfile();
      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single();

      if (!error && data) return { success: true, data: data as Expense };
      console.warn('addExpense Supabase failed:', error?.message);
      return { success: false, error: cloudAccountError('Harcama', error) };
    } catch (err) {
      console.warn('addExpense failed:', err);
      return { success: false, error: cloudAccountError('Harcama', err) };
    }
  }

  const localExpense: Expense = {
    id: makeLocalId('expense'),
    ...payload,
    category: payload.category as ExpenseCategory,
    repeat_type: payload.repeat_type as Expense['repeat_type'],
    payment_method: payload.payment_method as Expense['payment_method'],
    created_at: new Date().toISOString(),
  };

  writeLocal('expenses', [localExpense, ...readLocal<Expense>('expenses')]);
  return { success: true, data: localExpense };
}

export async function deleteExpense(id: string): Promise<void> {
  if (shouldUseLocalFallback() || id.startsWith('expense_')) {
    writeLocal('expenses', readLocal<Expense>('expenses').filter(item => item.id !== id));
    return;
  }
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) console.warn('deleteExpense Supabase failed:', error.message);
}

// ============================================
// INCOME
// ============================================

export async function loadIncome(startDate?: Date, endDate?: Date): Promise<IncomeRecord[]> {
  const userId = getDataOwnerId();
  const local = readLocalCandidates<IncomeRecord>('income');

  if (shouldUseLocalFallback()) return local;

  try {
    let query = supabase.from('income').select('*').eq('user_id', userId);

    if (startDate) query = query.gte('date', startDate.toISOString().split('T')[0]);
    if (endDate) query = query.lte('date', endDate.toISOString().split('T')[0]);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) {
      console.warn('loadIncome Supabase failed:', error.message);
      return local;
    }
    return mergeByIdOrSymbol((data as IncomeRecord[]) ?? [], local);
  } catch (err) {
    console.warn('loadIncome failed:', err);
    return local;
  }
}

export async function addIncome(i: {
  category: IncomeCategory;
  amount: number;
  currency: string;
  date: string;
  repeatType?: string;
  note?: string;
}): Promise<{ success: boolean; data?: IncomeRecord; error?: string }> {
  const userId = getDataOwnerId();
  const amount = Number(i.amount);

  if (!i.category) return { success: false, error: 'Kategori seçilmedi' };
  if (!isValidAmount(amount)) return { success: false, error: 'Tutar geçerli değil' };

  const payload = {
    user_id: userId,
    category: i.category,
    amount,
    currency: i.currency || 'TRY',
    date: i.date || new Date().toISOString().slice(0, 10),
    repeat_type: i.repeatType || 'none',
    note: i.note || null,
  };

  if (isCloudAccountMode()) {
    try {
      await ensureSessionProfile();
      const { data, error } = await supabase
        .from('income')
        .insert(payload)
        .select()
        .single();

      if (!error && data) return { success: true, data: data as IncomeRecord };
      console.warn('addIncome Supabase failed:', error?.message);
      return { success: false, error: cloudAccountError('Gelir', error) };
    } catch (err) {
      console.warn('addIncome failed:', err);
      return { success: false, error: cloudAccountError('Gelir', err) };
    }
  }

  const localIncome: IncomeRecord = {
    id: makeLocalId('income'),
    ...payload,
    category: payload.category as IncomeCategory,
    repeat_type: payload.repeat_type as IncomeRecord['repeat_type'],
    created_at: new Date().toISOString(),
  };

  writeLocal('income', [localIncome, ...readLocal<IncomeRecord>('income')]);
  return { success: true, data: localIncome };
}

export async function deleteIncome(id: string): Promise<void> {
  if (shouldUseLocalFallback() || id.startsWith('income_')) {
    writeLocal('income', readLocal<IncomeRecord>('income').filter(item => item.id !== id));
    return;
  }
  const { error } = await supabase.from('income').delete().eq('id', id);
  if (error) console.warn('deleteIncome Supabase failed:', error.message);
}

// ============================================
// LIABILITIES
// ============================================

export async function loadLiabilities(): Promise<Liability[]> {
  const userId = getDataOwnerId();
  const local = readLocal<Liability>('liabilities');
  if (shouldUseLocalFallback()) return local;
  try {
    const { data, error } = await supabase.from('liabilities').select('*').eq('user_id', userId);
    if (error) return local;
    return (data as Liability[]) ?? [];
  } catch (err) {
    console.warn('Cloud data load failed:', err);
    return [];
  }
}

export async function addLiability(l: {
  name: string;
  amount: number;
  currency: string;
  dueDate?: string;
  monthlyPayment?: number;
  category?: string;
}): Promise<Liability> {
  const userId = getDataOwnerId();
  const payload = {
    id: makeLocalId('liability'),
    user_id: userId,
    name: l.name,
    amount: l.amount,
    currency: l.currency,
    due_date: l.dueDate || null,
    monthly_payment: l.monthlyPayment || 0,
    category: l.category || 'other',
    created_at: new Date().toISOString(),
  } as Liability;

  if (isCloudAccountMode()) {
    try {
      await ensureSessionProfile();
      const { data, error } = await supabase
        .from('liabilities')
        .insert(payload)
        .select()
        .single();
      if (!error && data) return data as Liability;
    } catch (err) {
      console.warn('addLiability failed, saving locally:', err);
    }
  }

  writeLocal('liabilities', [payload, ...readLocal<Liability>('liabilities')]);
  return payload;
}

export async function deleteLiability(id: string): Promise<void> {
  writeLocal('liabilities', readLocal<Liability>('liabilities').filter(item => item.id !== id));
  if (!hasSupabaseConfig() || id.startsWith('liability_')) return;
  await supabase.from('liabilities').delete().eq('id', id);
}

// ============================================
// CASH ACCOUNTS
// ============================================

export async function loadCashAccounts(): Promise<CashAccount[]> {
  const userId = getDataOwnerId();
  const local = readLocal<CashAccount>('cash_accounts');
  if (shouldUseLocalFallback()) return local;
  try {
    const { data, error } = await supabase.from('cash_accounts').select('*').eq('user_id', userId);
    if (error) return local;
    return (data as CashAccount[]) ?? [];
  } catch (err) {
    console.warn('Cloud data load failed:', err);
    return [];
  }
}

export async function addCashAccount(a: {
  name: string;
  balance: number;
  currency: string;
  accountType: string;
}): Promise<CashAccount> {
  const userId = getDataOwnerId();
  const payload = {
    id: makeLocalId('cash'),
    user_id: userId,
    name: a.name,
    balance: a.balance,
    currency: a.currency,
    account_type: a.accountType,
    created_at: new Date().toISOString(),
  } as CashAccount;

  if (isCloudAccountMode()) {
    try {
      await ensureSessionProfile();
      const { data, error } = await supabase
        .from('cash_accounts')
        .insert(payload)
        .select()
        .single();
      if (!error && data) return data as CashAccount;
    } catch (err) {
      console.warn('addCashAccount failed, saving locally:', err);
    }
  }

  writeLocal('cash_accounts', [payload, ...readLocal<CashAccount>('cash_accounts')]);
  return payload;
}

export async function updateCashAccount(id: string, balance: number): Promise<void> {
  writeLocal('cash_accounts', readLocal<CashAccount>('cash_accounts').map(item => item.id === id ? { ...item, balance } : item));
  if (!hasSupabaseConfig() || id.startsWith('cash_')) return;
  await supabase.from('cash_accounts').update({ balance }).eq('id', id);
}

export async function deleteCashAccount(id: string): Promise<void> {
  writeLocal('cash_accounts', readLocal<CashAccount>('cash_accounts').filter(item => item.id !== id));
  if (!hasSupabaseConfig() || id.startsWith('cash_')) return;
  await supabase.from('cash_accounts').delete().eq('id', id);
}

// ============================================
// EXCHANGE RATES
// ============================================

export async function loadExchangeRates(): Promise<ExchangeRate[]> {
  const fallback: ExchangeRate[] = [
    { id: 'local-usdtry', pair: 'USDTRY', rate: 45.5, timestamp: new Date().toISOString(), source: 'mock' } as ExchangeRate,
    { id: 'local-eurtry', pair: 'EURTRY', rate: 49.2, timestamp: new Date().toISOString(), source: 'mock' } as ExchangeRate,
  ];

  // Prefer live quote API so the home page conversion rate updates even if exchange_rates table is empty.
  try {
    const quotes = await fetchQuotes(['USDTRY=X', 'EURTRY=X']);
    const now = new Date().toISOString();
    const live: ExchangeRate[] = [];
    if (quotes['USDTRY=X']?.price) live.push({ id: 'live-usdtry', pair: 'USDTRY', rate: quotes['USDTRY=X'].price, timestamp: now, source: quotes['USDTRY=X'].source || 'live' } as ExchangeRate);
    if (quotes['EURTRY=X']?.price) live.push({ id: 'live-eurtry', pair: 'EURTRY', rate: quotes['EURTRY=X'].price, timestamp: now, source: quotes['EURTRY=X'].source || 'live' } as ExchangeRate);
    if (live.length > 0) return live;
  } catch {}

  if (!hasSupabaseConfig()) return fallback;

  try {
    const { data, error } = await supabase.from('exchange_rates').select('*');
    if (error) return fallback;
    return ((data as ExchangeRate[]) ?? fallback).length > 0 ? (data as ExchangeRate[]) : fallback;
  } catch {
    return fallback;
  }
}

export async function getRate(pair: string): Promise<number> {
  const rates = await loadExchangeRates();
  const r = rates.find(x => x.pair === pair);
  return r?.rate || 1;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatCurrency(value: number, currency: string): string {
  const locale = currency === 'TRY' ? 'tr-TR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function isMarketOpen(market: Market): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;

  const mins = utcH * 60 + utcM;

  if (market === 'BIST') {
    return mins >= 7 * 60 && mins < 15 * 60;
  }
  if (market === 'US' || market === 'NASDAQ') {
    return mins >= 13 * 60 + 30 && mins < 20 * 60;
  }
  if (market === 'FX') {
    return true;
  }
  return false;
}

export function getMarketBadge(market: Market): { label: string; class: string } {
  const labels: Record<Market, string> = {
    BIST: 'BIST',
    NASDAQ: 'NASDAQ',
    US: 'NYSE/NQ',
    FUND: 'FON',
    FX: 'DÖVİZ',
    METAL: 'EMTİA',
    CRYPTO: 'KRİPTO',
    CASH: 'NAKİT',
  };

  const classes: Record<Market, string> = {
    BIST: 'badge-bist',
    NASDAQ: 'badge-us',
    US: 'badge-us',
    FUND: 'badge-fund',
    FX: 'badge-fx',
    METAL: 'badge-metal',
    CRYPTO: 'badge-fund',
    CASH: 'badge-fx',
  };

  return { label: labels[market] || market, class: classes[market] || '' };
}
