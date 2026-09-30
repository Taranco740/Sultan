import { localTradingDay } from './trading';

export type TradeSide = 'buy' | 'sell';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'pending';

export interface TradeRecord {
  id: string;
  user_id: string;
  account_id: string;
  trading_day: string;
  symbol: string;
  side: TradeSide;
  setup: string;
  reason: string;
  emotion: string;
  lesson: string;
  followed_plan: boolean;
  outcome: TradeOutcome | null;
  created_at: string;
}

export interface TradeInsights {
  total: number;
  closed: number;
  wins: number;
  losses: number;
  breakeven: number;
  pending: number;
  winRate: number;
  planFollowingRate: number;
  planFollowingCount: number;
  tradedDays: number;
  currentWinStreak: number;
}

export interface DailyOutcome {
  day: string;
  trades: number;
  wins: number;
  losses: number;
  net: number;
}

export function getTradeInsights(trades: TradeRecord[]): TradeInsights {
  const closedTrades = trades.filter((trade) => trade.outcome === 'win' || trade.outcome === 'loss' || trade.outcome === 'breakeven');
  const wins = closedTrades.filter((trade) => trade.outcome === 'win').length;
  const losses = closedTrades.filter((trade) => trade.outcome === 'loss').length;
  const breakeven = closedTrades.filter((trade) => trade.outcome === 'breakeven').length;
  const planFollowingCount = trades.filter((trade) => trade.followed_plan).length;
  const chronological = [...trades].sort((a, b) => b.trading_day.localeCompare(a.trading_day) || b.created_at.localeCompare(a.created_at));
  let currentWinStreak = 0;
  for (const trade of chronological) {
    if (trade.outcome === 'pending') continue;
    if (trade.outcome !== 'win') break;
    currentWinStreak += 1;
  }
  return {
    total: trades.length,
    closed: closedTrades.length,
    wins,
    losses,
    breakeven,
    pending: trades.length - closedTrades.length,
    winRate: closedTrades.length ? Math.round((wins / closedTrades.length) * 1000) / 10 : 0,
    planFollowingRate: trades.length ? Math.round((planFollowingCount / trades.length) * 1000) / 10 : 0,
    planFollowingCount,
    tradedDays: new Set(trades.map((trade) => trade.trading_day)).size,
    currentWinStreak,
  };
}

export function getDailyOutcomes(trades: TradeRecord[], limit = 14): DailyOutcome[] {
  const grouped = new Map<string, DailyOutcome>();
  for (const trade of trades) {
    const row = grouped.get(trade.trading_day) ?? { day: trade.trading_day, trades: 0, wins: 0, losses: 0, net: 0 };
    row.trades += 1;
    if (trade.outcome === 'win') row.wins += 1;
    if (trade.outcome === 'loss') row.losses += 1;
    row.net = row.wins - row.losses;
    grouped.set(trade.trading_day, row);
  }
  return [...grouped.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-limit);
}

export function monthCalendarDays(month = new Date()): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return localTradingDay(day);
  });
}

