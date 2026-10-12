import { DonorOption } from '../data/donorsData';

const NBSP3 = '   ';

/** What the user sees for a donor: the name, 3 spaces, then the username in parentheses. */
export const donorLabel = (d: DonorOption) => `${d.name}${NBSP3}(${d.username})`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> YYYY-MM-DD */
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** YYYY-MM-DD -> Date (local), or null when the text is not a real date. */
export function parseDate(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** Adds whole months; a day that does not exist in the target month becomes its last day. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/**
 * The schedule for a donation: the first element is the start date, then one month later each,
 * counted from the start date. Empty when the start date or the count is not usable.
 */
export function buildSchedule(startDate: string, totalNumberOfDonations: number): string[] {
  const start = parseDate(startDate);
  if (!start || totalNumberOfDonations <= 0) return [];
  return Array.from({ length: totalNumberOfDonations }, (_, i) => formatDate(addMonths(start, i)));
}

export const money = (value: number | null) =>
  value === null
    ? ''
    : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
