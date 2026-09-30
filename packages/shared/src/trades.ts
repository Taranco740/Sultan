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

export function monthCalendarDays(month = new Date()): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return localTradingDay(day);
  });
}

