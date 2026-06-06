// Turkish Investment Funds Provider (TEFAS-style)
// Fund prices are updated daily after NAV calculation
// TODO: Connect to real TEFAS API when available

import type { QuoteResult, HistoryPoint, DataProvider } from './types';

// Turkish fund categories
export const FUND_TYPES = {
  STOCK: 'Hisse Senedi Fonları',
  BOND: 'Borçlanma Araçları Fonları',
  MIXED: 'Karma Fonlar',
  MONEY_MARKET: 'Para Piyasası Fonları',
  VARIABLE: 'Değişken Fonlar',
  INDEX: 'Endeks Fonları',
  EXCHANGE_TRADED: 'Borsa Ticaret Fonları (ETF)',
  REAL_ESTATE: 'Gayrimenkul Fonları',
  PRECIOUS_METAL: 'Kıymetli Maden Fonları',
} as const;

export interface FundInfo {
  code: string;
  name: string;
  type: string;
  manager: string;
  currency: string;
  riskLevel: number; // 1-7
}

// Sample Turkish funds data
const SAMPLE_FUNDS: FundInfo[] = [
  { code: 'A1', name: 'Ak Portföy Hisse Senedi Fonu', type: 'Hisse Senedi', manager: 'Ak Portföy', currency: 'TRY', riskLevel: 6 },
  { code: 'YKO', name: 'Yapı Kredi Portföy Hisse Senedi Fonu', type: 'Hisse Senedi', manager: 'Yapı Kredi', currency: 'TRY', riskLevel: 6 },
  { code: 'ICI', name: 'İş Portföy İkinci Derece Fon', type: 'Hisse Senedi', manager: 'İş Portföy', currency: 'TRY', riskLevel: 6 },
  { code: 'GAN', name: 'Garanti Portföy Hisse Fonu', type: 'Hisse Senedi', manager: 'Garanti Portföy', currency: 'TRY', riskLevel: 6 },
  { code: 'HNZ', name: 'HSBC Portföy Girişim Fonu', type: 'Hisse Senedi', manager: 'HSBC Portföy', currency: 'TRY', riskLevel: 7 },
  { code: 'AKG', name: 'Ak Portföy Altın Fonu', type: 'Kıymetli Maden', manager: 'Ak Portföy', currency: 'TRY', riskLevel: 5 },
  { code: 'YAP', name: 'Yapı Kredi Portföy Büyüme Fonu', type: 'Karma', manager: 'Yapı Kredi', currency: 'TRY', riskLevel: 5 },
  { code: 'ISR', name: 'İş Portföy Stok Fonu', type: 'Hisse Senedi', manager: 'İş Portföy', currency: 'TRY', riskLevel: 6 },
  { code: 'GAR', name: 'Garanti Portföy Karma Fon', type: 'Karma', manager: 'Garanti Portföy', currency: 'TRY', riskLevel: 4 },
  { code: 'BIM', name: 'BİM Portföy Fonu', type: 'Para Piyasası', manager: 'BİM Portföy', currency: 'TRY', riskLevel: 2 },
];

export class FundProvider implements DataProvider {
  name = 'funds-tefas';
  private lastUpdate: Date | null = null;
  private fundPrices: Map<string, QuoteResult> = new Map();
  private fundHistory: Map<string, HistoryPoint[]> = new Map();

  constructor() {
    // Initialize with mock data
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const basePrices: Record<string, number> = {
      'A1': 82.50, 'YKO': 145.20, 'ICI': 28.80, 'GAN': 95.60, 'HNZ': 42.30,
      'AKG': 1250.00, 'YAP': 68.90, 'ISR': 35.40, 'GAR': 112.80, 'BIM': 1.45,
    };

    for (const fund of SAMPLE_FUNDS) {
      const base = basePrices[fund.code] || 100;
      this.fundPrices.set(fund.code, {
        symbol: fund.code,
        price: base,
        name: fund.name,
        currency: 'TRY',
        change: Math.random() * base * 0.05 - base * 0.02,
        changePercent: (Math.random() - 0.5) * 4,
        timestamp: new Date().toISOString(),
        source: 'tefas-mock',
      });

      // Generate mock history
      const points: HistoryPoint[] = [];
      const now = new Date();
      for (let i = 365; i >= 0; i -= 7) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const variance = (Math.random() - 0.4) * 0.25 * base;
        points.push({
          date: d.toISOString().slice(0, 10),
          close: Math.max(base * 0.5, base + variance),
        });
      }
      this.fundHistory.set(fund.code, points);
    }
  }

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    return this.fundPrices.get(symbol) || null;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
    const results: Record<string, QuoteResult> = {};
    for (const symbol of symbols) {
      if (this.fundPrices.has(symbol)) {
        results[symbol] = this.fundPrices.get(symbol)!;
      }
    }
    this.lastUpdate = new Date();
    return results;
  }

  async getHistory(symbol: string, range: string = '1y'): Promise<HistoryPoint[]> {
    const history = this.fundHistory.get(symbol) || [];
    // Filter by range
    let days = 365;
    if (range === '6m') days = 180;
    if (range === '1m') days = 30;
    if (range === '1w') days = 7;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return history.filter(p => new Date(p.date) >= cutoff);
  }

  isMarketOpen(): boolean {
    // Funds are updated once daily after market close
    // Return true during typical update hours (18:00-20:00 TRT)
    const now = new Date();
    const utcHour = now.getUTCHours();
    return utcHour >= 15 && utcHour < 18;
  }

  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }

  // Search funds by code or name
  async searchFunds(query: string): Promise<FundInfo[]> {
    const q = query.toLowerCase();
    return SAMPLE_FUNDS.filter(f =>
      f.code.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q)
    );
  }

  // Get fund info
  async getFundInfo(code: string): Promise<FundInfo | null> {
    return SAMPLE_FUNDS.find(f => f.code === code) || null;
  }

  // Get all funds list
  async getAllFunds(): Promise<FundInfo[]> {
    return SAMPLE_FUNDS;
  }

  // Refresh fund prices from TEFAS (would call real API)
  async refreshPrices(): Promise<void> {
    // TODO: Call TEFAS API when available
    // For now, simulate some price movement
    for (const [code, quote] of this.fundPrices) {
      const change = (Math.random() - 0.5) * 0.02 * quote.price;
      this.fundPrices.set(code, {
        ...quote,
        price: quote.price + change,
        change,
        changePercent: (change / quote.price) * 100,
        timestamp: new Date().toISOString(),
      });
    }
    this.lastUpdate = new Date();
  }
}

export const fundProvider = new FundProvider();
