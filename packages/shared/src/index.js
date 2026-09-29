export const SULTAN_AREAS = [
  { id: 'personal', label: 'Personal', tint: '#f472b6' },
  { id: 'trading', label: 'Trading', tint: '#60a5fa' },
  { id: 'health', label: 'Health', tint: '#4ade80' },
  { id: 'work', label: 'Work & Wealth', tint: '#a78bfa' },
];

export function areaScore(done, planned, streakDays = 0) {
  if (!planned) return null;
  return Math.min(100, Math.round((done / planned) * 90 + Math.min(streakDays, 10)));
}

export function areaFlag(score, daysSinceLast = 0) {
  if (score === null) return 'unplanned';
  if (score < 40 || daysSinceLast >= 4) return 'lacking';
  if (score >= 75) return 'strong';
  return 'steady';
}

export function localDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
