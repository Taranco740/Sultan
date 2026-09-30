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

export type Mt5DealType =
  | 'buy' | 'sell' | 'balance' | 'credit' | 'charge' | 'correction' | 'bonus'
  | 'commission' | 'commission_daily' | 'commission_monthly' | 'interest'
  | 'dividend' | 'tax' | 'other';

export type Mt5EntryType = 'in' | 'out' | 'inout' | 'out_by' | 'other';

export interface Mt5Connection {
  id: string;
  user_id: string;
  account_id: string;
  label: string;
  broker_server: string | null;
  last_sync_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface Mt5Deal {
  id: string;
  user_id: string;
  account_id: string;
  connection_id: string;
  ticket: string | number;
  order_id: string | number | null;
  position_id: string | number | null;
  time_msc: string | number;
  deal_type: Mt5DealType;
  entry_type: Mt5EntryType;
  symbol: string;
  volume: string | number;
  price: string | number;
  profit: string | number;
  commission: string | number;
  swap: string | number;
  fee: string | number;
  currency: string;
}

export interface Mt5PositionSummary {
  key: string;
  positionId: string;
  symbol: string;
  side: TradeSide;
  volume: number;
  netProfit: number;
  currency: string;
  openedAt: number;
  lastActivityAt: number;
  status: 'open' | 'closed';
  dealCount: number;
}

export interface Mt5Insights {
  positions: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  breakeven: number;
  buys: number;
  sells: number;
  lots: number;
  realizedNet: number;
  currency: string;
  winRate: number;
}

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMt5PositionSummaries(deals: Mt5Deal[]): Mt5PositionSummary[] {
  const ordered = [...deals].sort((a, b) => numberValue(a.time_msc) - numberValue(b.time_msc));
  const groups = new Map<string, { deals: Mt5Deal[]; positionId: string; connectionId: string }>();
  for (const deal of ordered) {
    const positionId = String(deal.position_id ?? deal.ticket);
    const key = `${deal.connection_id}:${positionId}`;
    const group = groups.get(key) ?? { deals: [], positionId, connectionId: deal.connection_id };
    group.deals.push(deal);
    groups.set(key, group);
  }

  const positions: Mt5PositionSummary[] = [];
  for (const [key, group] of groups) {
    const tradeDeals = group.deals.filter((deal) => deal.deal_type === 'buy' || deal.deal_type === 'sell');
    if (!tradeDeals.length) continue;
    const openingDeal = tradeDeals.find((deal) => deal.entry_type === 'in' || deal.entry_type === 'inout') ?? tradeDeals[0];
    const signedVolume = tradeDeals.reduce((net, deal) => net + (deal.deal_type === 'buy' ? 1 : -1) * numberValue(deal.volume), 0);
    const closed = Math.abs(signedVolume) < 0.00000001;
    const netProfit = group.deals.reduce((sum, deal) => sum + numberValue(deal.profit) + numberValue(deal.commission) + numberValue(deal.swap) + numberValue(deal.fee), 0);
    const openingTime = numberValue(openingDeal.time_msc);
    positions.push({
      key,
      positionId: group.positionId,
      symbol: openingDeal.symbol || tradeDeals.find((deal) => deal.symbol)?.symbol || '—',
      side: openingDeal.deal_type === 'sell' ? 'sell' : 'buy',
      volume: tradeDeals.filter((deal) => deal.entry_type === 'in' || deal.entry_type === 'inout').reduce((sum, deal) => sum + numberValue(deal.volume), 0),
      netProfit,
      currency: group.deals.find((deal) => deal.currency)?.currency ?? '',
      openedAt: openingTime,
      lastActivityAt: group.deals.reduce((latest, deal) => Math.max(latest, numberValue(deal.time_msc)), 0),
      status: closed ? 'closed' : 'open',
      dealCount: group.deals.length,
    });
  }
  return positions.sort((a, b) => b.openedAt - a.openedAt);
}

export function getMt5Insights(positions: Mt5PositionSummary[]): Mt5Insights {
  const closed = positions.filter((position) => position.status === 'closed');
  const wins = closed.filter((position) => position.netProfit > 0.00000001).length;
  const losses = closed.filter((position) => position.netProfit < -0.00000001).length;
  const breakeven = closed.length - wins - losses;
  return {
    positions: positions.length,
    closed: closed.length,
    open: positions.length - closed.length,
    wins,
    losses,
    breakeven,
    buys: positions.filter((position) => position.side === 'buy').length,
    sells: positions.filter((position) => position.side === 'sell').length,
    lots: positions.reduce((sum, position) => sum + position.volume, 0),
    realizedNet: closed.reduce((sum, position) => sum + position.netProfit, 0),
    currency: positions.find((position) => position.currency)?.currency ?? '',
    winRate: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : 0,
  };
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

