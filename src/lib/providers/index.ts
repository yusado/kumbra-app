// Data Providers Index
// Central export for all data providers

export * from './types';
export { yahooProvider } from './yahooProvider';
export { bistProvider, MockBISTProvider, BISTProvider } from './bistProvider';
export { usStockProvider, MockUSStockProvider, USStockProvider } from './usStockProvider';
export { fxMetalsProvider, MockFXMetalsProvider, FXMetalsProvider, FX_SYMBOLS, METAL_SYMBOLS } from './fxMetalsProvider';
export { fundProvider, FundProvider, FUND_TYPES } from './fundProvider';
export type { FundInfo } from './fundProvider';

import { yahooProvider } from './yahooProvider';
import { bistProvider } from './bistProvider';
import { usStockProvider } from './usStockProvider';
import { fxMetalsProvider } from './fxMetalsProvider';
import { fundProvider } from './fundProvider';
import type { QuoteResult, DataProvider } from './types';

// Unified price fetcher that routes to appropriate provider
export async function fetchAllQuotes(symbols: string[]): Promise<Record<string, QuoteResult>> {
  const results: Record<string, QuoteResult> = {};

  // Categorize symbols by type
  const bistSymbols: string[] = [];
  const usSymbols: string[] = [];
  const fxSymbols: string[] = [];
  const fundSymbols: string[] = [];

  for (const symbol of symbols) {
    if (symbol.endsWith('.IS') || symbol.startsWith('XU')) {
      bistSymbols.push(symbol);
    } else if (symbol.includes('=X') || symbol.endsWith('=F')) {
      fxSymbols.push(symbol);
    } else if (symbol.length <= 3 || /^[A-Z][A-Z0-9]?$/.test(symbol)) {
      // Short symbols are likely funds
      fundSymbols.push(symbol);
    } else {
      usSymbols.push(symbol);
    }
  }

  // Fetch from appropriate providers in parallel
  const [bistQuotes, usQuotes, fxQuotes, fundQuotes] = await Promise.all([
    bistSymbols.length > 0 ? bistProvider.getQuotes(bistSymbols) : Promise.resolve({}),
    usSymbols.length > 0 ? usStockProvider.getQuotes(usSymbols) : Promise.resolve({}),
    fxSymbols.length > 0 ? fxMetalsProvider.getQuotes(fxSymbols) : Promise.resolve({}),
    fundSymbols.length > 0 ? fundProvider.getQuotes(fundSymbols) : Promise.resolve({}),
  ]);

  // Merge all results
  Object.assign(results, bistQuotes, usQuotes, fxQuotes, fundQuotes);

  return results;
}

// Get provider for a specific market
export function getProviderForMarket(market: string): DataProvider {
  switch (market.toUpperCase()) {
    case 'BIST':
      return bistProvider;
    case 'US':
    case 'NASDAQ':
    case 'NYSE':
      return usStockProvider;
    case 'FX':
    case 'METAL':
      return fxMetalsProvider;
    case 'FUND':
      return fundProvider;
    default:
      return yahooProvider;
  }
}

// Export singleton instances
export const providers = {
  yahoo: yahooProvider,
  bist: bistProvider,
  usStocks: usStockProvider,
  fxMetals: fxMetalsProvider,
  funds: fundProvider,
};
