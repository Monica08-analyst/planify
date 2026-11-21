import type { RecurrenceRule } from '../types';

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return toISODate(dt);
}

export function getNextRecurrenceDate(isoDate: string, rule: RecurrenceRule): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);

  switch (rule) {
    case 'daily':
      dt.setDate(dt.getDate() + 1);
      break;
    case 'weekdays': {
      do {
        dt.setDate(dt.getDate() + 1);
      } while (dt.getDay() === 0 || dt.getDay() === 6);
      break;
    }
    case 'weekly':
      dt.setDate(dt.getDate() + 7);
      break;
    case 'monthly':
      dt.setMonth(dt.getMonth() + 1);
      break;
    default:
      break;
  }

  return toISODate(dt);
}

export function daysUntilOccasion(isoDate: string, repeatsYearly: boolean): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = isoDate.split('-').map(Number);
  let target = new Date(y, (m || 1) - 1, d || 1);

  if (repeatsYearly) {
    target = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
    if (target.getTime() < todayMidnight.getTime()) {
      target = new Date(now.getFullYear() + 1, (m || 1) - 1, d || 1);
    }
  }

  const diffMs = target.getTime() - todayMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatFriendlyDate(isoDate: string): string {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const yesterday = addDaysISO(today, -1);

  if (isoDate === today) return 'Today';
  if (isoDate === tomorrow) return 'Tomorrow';
  if (isoDate === yesterday) return 'Yesterday';

  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getLastNDays(count: number): string[] {
  const today = todayISO();
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    days.push(addDaysISO(today, -i));
  }
  return days;
}

export function formatMinutesLabel(minutes: number): string {
  if (minutes === 0) return 'At due time';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes === 60) return '1 hour before';
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours before`;
  return `${Math.round(minutes / 1440)} day(s) before`;
}
