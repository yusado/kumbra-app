// FX and Precious Metals Provider
// Uses Yahoo Finance for exchange rates and metals prices

import type { QuoteResult, HistoryPoint, DataProvider } from './types';
import { isMarketOpenUTC } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Standard FX and metal symbols
export const FX_SYMBOLS = {
  USDTRY: 'USDTRY=X',
  EURTRY: 'EURTRY=X',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
};

export const METAL_SYMBOLS = {
  GOLD: 'GC=F',      // Gold Futures
  SILVER: 'SI=F',    // Silver Futures
  GOLD_TRY: 'XAUTRY=X', // Gram Altin (if available)
};

export class FXMetalsProvider implements DataProvider {
  name = 'fx-metals';
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
      console.error('FX/Metals provider error:', err);
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
    return isMarketOpenUTC('FX');
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }

  // Helper to get all FX rates
  async getAllFXRates(): Promise<Record<string, number>> {
    const symbols = Object.values(FX_SYMBOLS);
    const quotes = await this.getQuotes(symbols);
    const rates: Record<string, number> = {};
    for (const symbol of symbols) {
      if (quotes[symbol]) {
        rates[symbol.replace('=X', '')] = quotes[symbol].price;
      }
    }
    return rates;
  }
}

// Mock FX/Metals provider
export class MockFXMetalsProvider implements DataProvider {
  name = 'mock-fx';
  private mockData: Map<string, QuoteResult> = new Map([
    ['USDTRY=X', { symbol: 'USDTRY=X', price: 45.50, name: 'ABD Doları / TL', currency: 'TRY', change: 0.08, changePercent: 0.18, timestamp: new Date().toISOString(), source: 'mock' }],
    ['EURTRY=X', { symbol: 'EURTRY=X', price: 49.20, name: 'Euro / TL', currency: 'TRY', change: 0.12, changePercent: 0.24, timestamp: new Date().toISOString(), source: 'mock' }],
    ['EURUSD=X', { symbol: 'EURUSD=X', price: 1.0815, name: 'Euro / Dolar', currency: 'USD', change: 0.0005, changePercent: 0.05, timestamp: new Date().toISOString(), source: 'mock' }],
    ['GC=F', { symbol: 'GC=F', price: 2350.00, name: 'Altın Vadeli', currency: 'USD', change: 12.50, changePercent: 0.53, timestamp: new Date().toISOString(), source: 'mock' }],
    ['SI=F', { symbol: 'SI=F', price: 29.80, name: 'Gümüş Vadeli', currency: 'USD', change: -0.15, changePercent: -0.50, timestamp: new Date().toISOString(), source: 'mock' }],
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
    const base = this.mockData.get(symbol)?.price || 1;
    const points: HistoryPoint[] = [];
    const now = new Date();
    const days = range === '1y' ? 365 : range === '6m' ? 180 : 30;

    for (let i = days; i >= 0; i -= 7) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const variance = (Math.random() - 0.5) * 0.08 * base;
      points.push({
        date: d.toISOString().slice(0, 10),
        close: Math.max(base * 0.7, base + variance),
      });
    }
    return points;
  }

  isMarketOpen(): boolean {
    return true; // FX is 24/5
  }

  getLastUpdate(): Date | null {
    return new Date();
  }
}

export const fxMetalsProvider = new FXMetalsProvider();
