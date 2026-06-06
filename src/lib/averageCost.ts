// Average Cost Calculation Helpers
// Weighted average cost method for portfolio tracking

import type { Transaction } from '../types';

/**
 * Computed holding for a single asset
 */
export interface ComputedHolding {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;           // Current quantity held
  avgCost: number;            // Weighted average cost per unit
  totalCost: number;          // Total invested amount
  realizedPL: number;         // Realized profit/loss from sells
  totalDividends: number;     // Total dividends received
  totalFees: number;          // Total fees/commissions paid
}

/**
 * Transaction for average cost calculation
 */
export interface CostTransaction {
  type: 'buy' | 'sell' | 'dividend' | 'fee';
  quantity: number;
  price: number;
  fee?: number;
  date: string;
}

/**
 * Calculate weighted average cost for a series of transactions
 * Uses FIFO-like logic: buys increase position, sells reduce and realize P/L
 */
export function calculateAverageCost(transactions: CostTransaction[]): ComputedHolding {
  let quantity = 0;
  let totalCost = 0;
  let realizedPL = 0;
  let totalDividends = 0;
  let totalFees = 0;

  // Sort by date (oldest first)
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const tx of sorted) {
    const fee = tx.fee || 0;
    totalFees += fee;

    switch (tx.type) {
      case 'buy':
        totalCost += tx.quantity * tx.price + fee;
        quantity += tx.quantity;
        break;

      case 'sell':
        if (quantity > 0 && tx.quantity > 0) {
          // Calculate average cost at this point
          const avgCost = quantity > 0 ? totalCost / quantity : 0;
          const sellQty = Math.min(tx.quantity, quantity);
          const costBasis = sellQty * avgCost;
          const saleAmount = sellQty * tx.price;

          // Realize P/L for sold shares
          realizedPL += saleAmount - costBasis - (fee * sellQty / tx.quantity);

          // Reduce position
          quantity -= sellQty;
          totalCost = quantity * avgCost; // Remaining cost basis
        }
        break;

      case 'dividend':
        // Dividends reduce cost basis or add to realized P/L
        totalDividends += tx.quantity * tx.price - fee;
        break;

      case 'fee':
        // Standalone fee reduces cost basis
        totalFees += tx.price; // Price field used as fee amount
        break;
    }
  }

  const avgCost = quantity > 0 ? totalCost / quantity : 0;

  return {
    symbol: '',
    name: '',
    market: '',
    currency: '',
    quantity,
    avgCost,
    totalCost,
    realizedPL,
    totalDividends,
    totalFees,
  };
}

/**
 * Compute all holdings from a list of transactions
 * Groups by symbol and calculates average cost per symbol
 */
export function computeAllHoldings(transactions: Transaction[]): Map<string, ComputedHolding> {
  const holdings = new Map<string, ComputedHolding>();

  // Group transactions by symbol
  const bySymbol = new Map<string, CostTransaction[]>();

  for (const tx of transactions) {
    if (!bySymbol.has(tx.symbol)) {
      bySymbol.set(tx.symbol, []);
    }

    const costTx: CostTransaction = {
      type: tx.type === 'sell' || tx.type === 'fund_sell' ? 'sell' :
            tx.type === 'dividend' ? 'dividend' :
            tx.type === 'commission' ? 'fee' : 'buy',
      quantity: Math.abs(tx.quantity),
      price: tx.unit_price,
      fee: tx.fee,
      date: tx.transaction_date,
    };

    bySymbol.get(tx.symbol)!.push(costTx);
  }

  // Calculate holdings for each symbol
  for (const [symbol, txs] of bySymbol) {
    const holding = calculateAverageCost(txs);

    // Get asset info from first transaction
    const firstTx = transactions.find(t => t.symbol === symbol);

    holdings.set(symbol, {
      ...holding,
      symbol,
      name: firstTx?.asset_name || symbol,
      market: firstTx?.market || 'US',
      currency: firstTx?.currency || 'TRY',
    });
  }

  return holdings;
}

/**
 * Calculate unrealized P/L
 */
export function calculateUnrealizedPL(
  holding: ComputedHolding,
  currentPrice: number
): { value: number; percent: number } {
  if (holding.quantity <= 0) {
    return { value: 0, percent: 0 };
  }

  const currentValue = holding.quantity * currentPrice;
  const unrealizedPL = currentValue - holding.totalCost;
  const percent = holding.totalCost > 0 ? (unrealizedPL / holding.totalCost) * 100 : 0;

  return { value: unrealizedPL, percent };
}

/**
 * Calculate total P/L (realized + unrealized)
 */
export function calculateTotalPL(
  holding: ComputedHolding,
  currentPrice: number
): { value: number; percent: number } {
  const unrealized = calculateUnrealizedPL(holding, currentPrice);
  const totalValue = holding.realizedPL + holding.totalDividends + unrealized.value;
  const totalInvested = holding.totalCost;
  const percent = totalInvested > 0 ? (totalValue / totalInvested) * 100 : 0;

  return { value: totalValue, percent };
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPL: number;
  totalPLPercent: number;
  realizedPL: number;
  unrealizedPL: number;
  totalDividends: number;
  totalFees: number;
  holdings: Array<ComputedHolding & {
    currentPrice: number;
    currentValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    totalPL: number;
    totalPLPercent: number;
    allocation: number; // Percentage of portfolio
  }>;
}

/**
 * Calculate portfolio summary from holdings and current prices
 */
export function calculatePortfolioSummary(
  holdings: Map<string, ComputedHolding>,
  currentPrices: Record<string, number>
): PortfolioSummary {
  const holdingDetails: PortfolioSummary['holdings'] = [];
  let totalValue = 0;
  let totalCost = 0;

  // First pass: calculate values
  for (const [symbol, holding] of holdings) {
    if (holding.quantity <= 0) continue;

    const currentPrice = currentPrices[symbol] || 0;
    const currentValue = holding.quantity * currentPrice;
    const unrealized = calculateUnrealizedPL(holding, currentPrice);
    const totalPLInfo = calculateTotalPL(holding, currentPrice);

    holdingDetails.push({
      ...holding,
      currentPrice,
      currentValue,
      unrealizedPL: unrealized.value,
      unrealizedPLPercent: unrealized.percent,
      totalPL: totalPLInfo.value,
      totalPLPercent: totalPLInfo.percent,
      allocation: 0, // Will be calculated in second pass
    });

    totalValue += currentValue;
    totalCost += holding.totalCost;
  }

  // Second pass: calculate allocations
  for (const h of holdingDetails) {
    h.allocation = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
  }

  const realizedPL = holdingDetails.reduce((sum, h) => sum + h.realizedPL, 0);
  const unrealizedPL = holdingDetails.reduce((sum, h) => sum + h.unrealizedPL, 0);
  const totalDividends = holdingDetails.reduce((sum, h) => sum + h.totalDividends, 0);
  const totalFees = holdingDetails.reduce((sum, h) => sum + h.totalFees, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalPL,
    totalPLPercent,
    realizedPL,
    unrealizedPL,
    totalDividends,
    totalFees,
    holdings: holdingDetails.sort((a, b) => b.currentValue - a.currentValue),
  };
}
