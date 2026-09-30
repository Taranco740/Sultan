export type DashboardArea = 'trading' | 'personal';

export interface SultanArea {
  id: 'personal' | 'trading' | 'health' | 'work';
  label: string;
  tint: string;
}

export type TradeSide = 'buy' | 'sell';

export interface TradeJournalEntry {
  id: string;
  user_id: string;
  symbol: string;
  side: TradeSide;
  setup: string | null;
  reason: string | null;
  emotion: string | null;
  lesson: string | null;
  followed_plan: boolean | null;
  created_at: string;
}

export interface StrategyChecklistItem {
  id: string;
  user_id: string;
  strategy_id: string;
  label: string;
  position: number;
  required: boolean;
  created_at: string;
}

export const TRADEOS_AREAS: ReadonlyArray<{ id: DashboardArea; label: string }> = [
  { id: 'trading', label: 'Trading' },
  { id: 'personal', label: 'Personal' },
];

export const SULTAN_AREAS: readonly SultanArea[] = [
  { id: 'personal', label: 'Personal', tint: '#f472b6' },
  { id: 'trading', label: 'Trading', tint: '#60a5fa' },
  { id: 'health', label: 'Health', tint: '#4ade80' },
  { id: 'work', label: 'Work & Wealth', tint: '#a78bfa' },
];

export function areaScore(done: number, planned: number, streakDays = 0): number | null {
  if (!planned) return null;
  return Math.min(100, Math.round((done / planned) * 90 + Math.min(streakDays, 10)));
}

export function areaFlag(score: number | null, daysSinceLast = 0): 'unplanned' | 'lacking' | 'strong' | 'steady' {
  if (score === null) return 'unplanned';
  if (score < 40 || daysSinceLast >= 4) return 'lacking';
  if (score >= 75) return 'strong';
  return 'steady';
}

export function localDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

