export type AccountMode = 'demo' | 'live' | 'paper';

export interface TradingAccount {
  id: string;
  user_id: string;
  label: string;
  broker_name: string | null;
  mode: AccountMode;
  created_at: string;
}

export interface TradingChecklist {
  id: string;
  user_id: string;
  account_id: string;
  title: string;
  created_at: string;
}

export interface TradingChecklistItem {
  id: string;
  user_id: string;
  checklist_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface DailyChecklistCheck {
  user_id: string;
  item_id: string;
  trading_day: string;
  checked: boolean;
  updated_at: string;
}

export function localTradingDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

