// BIST Data Provider
// Uses Google Apps Script as primary source, with Yahoo Finance fallback
// Google Sheets can use GOOGLEFINANCE function for Turkish stocks

import type { QuoteResult, HistoryPoint, DataProvider } from './types';
import { isMarketOpenUTC } from './types';

// Google Apps Script URL (can be set via environment variable)
const GAS_URL = import.meta.env.VITE_BIST_GAS_URL;

// BIST symbols require .IS suffix for Yahoo
const YAHOO_SUFFIX = '.IS';

export class BISTProvider implements DataProvider {
  name = 'bist';
  private lastUpdate: Date | null = null;
  private cache: Map<string, QuoteResult> = new Map();

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    const quotes = await this.getQuotes([symbol]);
    return quotes[symbol] || null;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
    const results: Record<string, QuoteResult> = {};
    const timestamp = new Date().toISOString();

    // Try Google Apps Script first if configured
    if (GAS_URL) {
      try {
        const gsSymbols = symbols.map(s => s.replace(YAHOO_SUFFIX, ''));
        const res = await fetch(`${GAS_URL}?symbols=${gsSymbols.join(',')}`);

        if (res.ok) {
          const data = await res.json();
          for (const item of data.symbols || []) {
            results[item.symbol + YAHOO_SUFFIX] = {
              symbol: item.symbol + YAHOO_SUFFIX,
              price: item.price,
              name: item.name,
              currency: 'TRY',
              change: item.change || 0,
              changePercent: item.changePercent || 0,
              timestamp: item.timestamp || timestamp,
              source: 'google-sheets',
            };
          }
          this.lastUpdate = new Date();
        }
      } catch (err) {
        console.warn('BIST GAS fetch failed, falling back:', err);
      }
    }

    // Fallback: Use cached data or return empty
    for (const symbol of symbols) {
      if (!results[symbol] && this.cache.has(symbol)) {
        results[symbol] = { ...this.cache.get(symbol)!, source: 'cached' };
      }
    }

    // Update cache
    for (const [symbol, quote] of Object.entries(results)) {
      this.cache.set(symbol, quote);
    }

    return results;
  }

  async getHistory(symbol: string, range: string = '1y'): Promise<HistoryPoint[]> {
    // BIST historical data from Google Sheets would need cumulative snapshots
    // For now, return empty - history should be built from price snapshots in DB
    return [];
  }

  isMarketOpen(): boolean {
    return isMarketOpenUTC('BIST');
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }

  // Save price snapshot to database for historical tracking
  async saveSnapshot(symbol: string, quote: QuoteResult): Promise<void> {
    // This would save to asset_prices table
    // Implementation would use Supabase client
  }
}

// Mock BIST data for development
export class MockBISTProvider implements DataProvider {
  name = 'mock-bist';
  private mockData: Map<string, QuoteResult> = new Map([
    ['GARAN.IS', { symbol: 'GARAN.IS', price: 125.80, name: 'Garanti Bankası', currency: 'TRY', change: 1.20, changePercent: 0.96, timestamp: new Date().toISOString(), source: 'mock' }],
    ['THYAO.IS', { symbol: 'THYAO.IS', price: 295.00, name: 'Türk Hava Yolları', currency: 'TRY', change: 3.50, changePercent: 1.20, timestamp: new Date().toISOString(), source: 'mock' }],
    ['ASELS.IS', { symbol: 'ASELS.IS', price: 78.50, name: 'Aselsan', currency: 'TRY', change: -0.30, changePercent: -0.38, timestamp: new Date().toISOString(), source: 'mock' }],
    ['EREGL.IS', { symbol: 'EREGL.IS', price: 42.15, name: 'Ereğli Demir Çelik', currency: 'TRY', change: 0.45, changePercent: 1.08, timestamp: new Date().toISOString(), source: 'mock' }],
    ['BIMAS.IS', { symbol: 'BIMAS.IS', price: 285.00, name: 'BİM Mağazalar', currency: 'TRY', change: -2.50, changePercent: -0.87, timestamp: new Date().toISOString(), source: 'mock' }],
    ['SISE.IS', { symbol: 'SISE.IS', price: 68.20, name: 'Şişe Cam', currency: 'TRY', change: 0.80, changePercent: 1.19, timestamp: new Date().toISOString(), source: 'mock' }],
    ['AKBNK.IS', { symbol: 'AKBNK.IS', price: 52.40, name: 'Akbank', currency: 'TRY', change: 0.25, changePercent: 0.48, timestamp: new Date().toISOString(), source: 'mock' }],
    ['ISCTR.IS', { symbol: 'ISCTR.IS', price: 8.85, name: 'İş Bankası C', currency: 'TRY', change: 0.05, changePercent: 0.57, timestamp: new Date().toISOString(), source: 'mock' }],
    ['KCHOL.IS', { symbol: 'KCHOL.IS', price: 145.60, name: 'Koç Holding', currency: 'TRY', change: 1.10, changePercent: 0.76, timestamp: new Date().toISOString(), source: 'mock' }],
    ['TUPRS.IS', { symbol: 'TUPRS.IS', price: 182.00, name: 'Tüpraş', currency: 'TRY', change: -1.20, changePercent: -0.66, timestamp: new Date().toISOString(), source: 'mock' }],
    ['XU100.IS', { symbol: 'XU100.IS', price: 10250.50, name: 'BIST 100 Endeksi', currency: 'TRY', change: 85.30, changePercent: 0.84, timestamp: new Date().toISOString(), source: 'mock' }],
  ]);

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    return this.mockData.get(symbol) || null;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
    const results: Record<string, QuoteResult> = {};
    for (const symbol of symbols) {
      if (this.mockData.has(symbol)) {
        results[symbol] = this.mockData.get(symbol)!;
      }
    }
    return results;
  }

  async getHistory(symbol: string, range: string = '1y'): Promise<HistoryPoint[]> {
    // Generate mock history
    const base = this.mockData.get(symbol)?.price || 100;
    const points: HistoryPoint[] = [];
    const now = new Date();

    const days = range === '1y' ? 365 : range === '6m' ? 180 : range === '1m' ? 30 : 7;
    const step = range === '1y' ? 7 : range === '6m' ? 3 : 1;

    for (let i = days; i >= 0; i -= step) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const variance = (Math.random() - 0.4) * 0.15 * base;
      points.push({
        date: d.toISOString().slice(0, 10),
        close: Math.max(base * 0.5, base + variance),
      });
    }
    return points;
  }

  isMarketOpen(): boolean {
    return isMarketOpenUTC('BIST');
  }

  getLastUpdate(): Date | null {
    return new Date();
  }
}

// Use real provider if GAS_URL is configured, otherwise use mock
export const bistProvider = GAS_URL ? new BISTProvider() : new MockBISTProvider();
