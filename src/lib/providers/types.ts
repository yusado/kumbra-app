// Data Provider Types
// Each provider follows a consistent interface for easy swapping between mock and real implementations

export interface QuoteResult {
  symbol: string;
  price: number;
  name: string;
  currency: string;
  change: number;
  changePercent: number;
  change1w?: number;
  timestamp: string;
  source: string;
}

export interface HistoryPoint {
  date: string;
  close: number;
  volume?: number;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface DataProvider {
  name: string;
  getQuote(symbol: string): Promise<QuoteResult | null>;
  getQuotes(symbols: string[]): Promise<Record<string, QuoteResult>>;
  getHistory(symbol: string, range: string, interval?: string): Promise<HistoryPoint[]>;
  isMarketOpen(): boolean;
  getLastUpdate(): Date | null;
}

// Market hours helper
export function isMarketOpenUTC(market: 'BIST' | 'US' | 'FX' | 'METAL'): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();

  // Weekend check
  if (day === 0 || day === 6) return false;

  const minutes = utcHour * 60 + utcMinute;

  switch (market) {
    case 'BIST':
      // 10:00-18:00 TRT = 07:00-15:00 UTC
      return minutes >= 7 * 60 && minutes < 15 * 60;
    case 'US':
      // 09:30-16:00 ET = 13:30-20:00 UTC (standard time) or 13:30-20:00 UTC (daylight saving adjusted)
      return minutes >= 13 * 60 + 30 && minutes < 20 * 60;
    case 'FX':
      // Forex is 24/5
      return true;
    case 'METAL':
      // Metals follow COMEX hours roughly
      return minutes >= 13 * 60 + 20 && minutes < 18 * 60;
    default:
      return false;
  }
}

// Format market status
export function getMarketStatus(market: 'BIST' | 'US' | 'FX' | 'METAL'): { isOpen: boolean; label: string; nextEvent: string } {
  const isOpen = isMarketOpenUTC(market);
  const now = new Date();
  const utcHour = now.getUTCHours();

  let label = isOpen ? 'CANLI' : 'KAPALI';
  let nextEvent = '';

  if (!isOpen) {
    if (market === 'BIST') {
      if (utcHour < 7) nextEvent = `Açılış: 10:00 TRT`;
      else nextEvent = `Açılış: Yarın 10:00 TRT`;
    } else if (market === 'US') {
      if (utcHour < 13 || (utcHour === 13 && now.getUTCMinutes() < 30)) {
        nextEvent = `Açılış: 16:30 TRT`;
      } else {
        nextEvent = `Açılış: Yarın 16:30 TRT`;
      }
    }
  }

  return { isOpen, label, nextEvent };
}
