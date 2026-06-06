// US Stock Provider
// Uses Yahoo Finance via Supabase Edge Function
// Can be extended to use Twelve Data or other providers

import type { QuoteResult, HistoryPoint, DataProvider } from './types';
import { isMarketOpenUTC } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class USStockProvider implements DataProvider {
  name = 'us-stocks';
  private lastUpdate: Date | null = null;

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    const quotes = await this.getQuotes([symbol]);
    return quotes[symbol] || null;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
    if (symbols.length === 0) return {};

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-quotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
      });

      if (!res.ok) return {};

      this.lastUpdate = new Date();
      const data = await res.json();

      const results: Record<string, QuoteResult> = {};
      for (const [symbol, quote] of Object.entries(data)) {
        const q = quote as any;
        results[symbol] = {
          symbol,
          price: q.price,
          name: q.name,
          currency: q.currency,
          change: q.change || 0,
          changePercent: q.changePercent || 0,
          timestamp: new Date().toISOString(),
          source: 'yahoo',
        };
      }
      return results;
    } catch (err) {
      console.error('US Stock provider error:', err);
      return {};
    }
  }

  async getHistory(symbol: string, range: string = '1y'): Promise<HistoryPoint[]> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/fetch-quotes/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  isMarketOpen(): boolean {
    return isMarketOpenUTC('US');
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }
}

// Mock US Stock data
export class MockUSStockProvider implements DataProvider {
  name = 'mock-us';
  private mockData: Map<string, QuoteResult> = new Map([
    ['AAPL', { symbol: 'AAPL', price: 210.50, name: 'Apple Inc.', currency: 'USD', change: 2.30, changePercent: 1.10, timestamp: new Date().toISOString(), source: 'mock' }],
    ['MSFT', { symbol: 'MSFT', price: 415.20, name: 'Microsoft Corporation', currency: 'USD', change: 3.80, changePercent: 0.92, timestamp: new Date().toISOString(), source: 'mock' }],
    ['GOOGL', { symbol: 'GOOGL', price: 172.30, name: 'Alphabet Inc.', currency: 'USD', change: -0.70, changePercent: -0.40, timestamp: new Date().toISOString(), source: 'mock' }],
    ['AMZN', { symbol: 'AMZN', price: 185.80, name: 'Amazon.com Inc.', currency: 'USD', change: 1.20, changePercent: 0.65, timestamp: new Date().toISOString(), source: 'mock' }],
    ['NVDA', { symbol: 'NVDA', price: 880.00, name: 'NVIDIA Corporation', currency: 'USD', change: 15.40, changePercent: 1.78, timestamp: new Date().toISOString(), source: 'mock' }],
    ['TSLA', { symbol: 'TSLA', price: 248.50, name: 'Tesla Inc.', currency: 'USD', change: -3.20, changePercent: -1.27, timestamp: new Date().toISOString(), source: 'mock' }],
    ['META', { symbol: 'META', price: 495.60, name: 'Meta Platforms Inc.', currency: 'USD', change: 5.40, changePercent: 1.10, timestamp: new Date().toISOString(), source: 'mock' }],
    ['JPM', { symbol: 'JPM', price: 198.30, name: 'JPMorgan Chase & Co.', currency: 'USD', change: 0.80, changePercent: 0.40, timestamp: new Date().toISOString(), source: 'mock' }],
    ['V', { symbol: 'V', price: 285.40, name: 'Visa Inc.', currency: 'USD', change: 1.60, changePercent: 0.56, timestamp: new Date().toISOString(), source: 'mock' }],
    ['SPY', { symbol: 'SPY', price: 530.00, name: 'SPDR S&P 500 ETF', currency: 'USD', change: 3.50, changePercent: 0.67, timestamp: new Date().toISOString(), source: 'mock' }],
    ['QQQ', { symbol: 'QQQ', price: 460.00, name: 'Invesco QQQ Trust', currency: 'USD', change: 5.20, changePercent: 1.14, timestamp: new Date().toISOString(), source: 'mock' }],
    ['^GSPC', { symbol: '^GSPC', price: 5280.50, name: 'S&P 500', currency: 'USD', change: 35.20, changePercent: 0.67, timestamp: new Date().toISOString(), source: 'mock' }],
    ['^IXIC', { symbol: '^IXIC', price: 16850.00, name: 'NASDAQ Composite', currency: 'USD', change: 185.40, changePercent: 1.11, timestamp: new Date().toISOString(), source: 'mock' }],
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
    const base = this.mockData.get(symbol)?.price || 100;
    const points: HistoryPoint[] = [];
    const now = new Date();
    const days = range === '1y' ? 365 : range === '6m' ? 180 : range === '1m' ? 30 : 7;
    const step = range === '1y' ? 7 : range === '6m' ? 3 : 1;

    for (let i = days; i >= 0; i -= step) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const variance = (Math.random() - 0.45) * 0.2 * base;
      points.push({
        date: d.toISOString().slice(0, 10),
        close: Math.max(base * 0.5, base + variance),
      });
    }
    return points;
  }

  isMarketOpen(): boolean {
    return isMarketOpenUTC('US');
  }

  getLastUpdate(): Date | null {
    return new Date();
  }
}

// Use real provider by default, mock for fallback
export const usStockProvider = new USStockProvider();
