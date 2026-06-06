// Yahoo Finance Provider
// Uses Supabase Edge Function as proxy to avoid CORS and hide API logic

import type { QuoteResult, HistoryPoint, DataProvider } from './types';
import { isMarketOpenUTC } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class YahooFinanceProvider implements DataProvider {
  name = 'yahoo';
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

      if (!res.ok) {
        console.error('Yahoo provider error:', res.status);
        return {};
      }

      this.lastUpdate = new Date();
      const data = await res.json();

      // Convert to QuoteResult format
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
      console.error('Yahoo provider fetch error:', err);
      return {};
    }
  }

  async getHistory(symbol: string, range: string = '1y', interval: string = '1d'): Promise<HistoryPoint[]> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/fetch-quotes/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        {
          headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        }
      );

      if (!res.ok) return [];

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('History fetch error:', err);
      return [];
    }
  }

  isMarketOpen(): boolean {
    return true; // Yahoo covers multiple markets
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }
}

// Singleton instance
export const yahooProvider = new YahooFinanceProvider();
