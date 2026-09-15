import { CalendarEvent, CategoryMeta, EventCategory } from './types';

export const CATEGORIES: Record<EventCategory, CategoryMeta> = {
  'SAKK Event': {
    id: 'SAKK Event',
    label: 'SAKK Event',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/60',
    bgSolid: 'bg-indigo-600',
    textClass: 'text-indigo-800 dark:text-indigo-200',
    borderClass: 'border-indigo-200 dark:border-indigo-800/80',
    dotClass: 'bg-indigo-500',
    hex: '#4f46e5',
  },
  'SAKK meeting': {
    id: 'SAKK meeting',
    label: 'SAKK Meeting',
    bgLight: 'bg-sky-50 dark:bg-sky-950/60',
    bgSolid: 'bg-sky-600',
    textClass: 'text-sky-800 dark:text-sky-200',
    borderClass: 'border-sky-200 dark:border-sky-800/80',
    dotClass: 'bg-sky-500',
    hex: '#0284c7',
  },
  'Member Event (18+)': {
    id: 'Member Event (18+)',
    label: 'Member Event (18+)',
    bgLight: 'bg-amber-50 dark:bg-amber-950/60',
    bgSolid: 'bg-amber-600',
    textClass: 'text-amber-900 dark:text-amber-200',
    borderClass: 'border-amber-200 dark:border-amber-800/80',
    dotClass: 'bg-amber-500',
    hex: '#d97706',
  },
  'Member EVent (21+)': {
    id: 'Member EVent (21+)',
    label: 'Member Event (21+)',
    bgLight: 'bg-rose-50 dark:bg-rose-950/60',
    bgSolid: 'bg-rose-600',
    textClass: 'text-rose-800 dark:text-rose-200',
    borderClass: 'border-rose-200 dark:border-rose-800/80',
    dotClass: 'bg-rose-500',
    hex: '#e11d48',
  },
  celebration: {
    id: 'celebration',
    label: 'Celebration',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/60',
    bgSolid: 'bg-emerald-600',
    textClass: 'text-emerald-800 dark:text-emerald-200',
    borderClass: 'border-emerald-200 dark:border-emerald-800/80',
    dotClass: 'bg-emerald-500',
    hex: '#059669',
  },
  other: {
    id: 'other',
    label: 'Other',
    bgLight: 'bg-slate-100 dark:bg-slate-800/80',
    bgSolid: 'bg-slate-600',
    textClass: 'text-slate-800 dark:text-slate-200',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-500',
    hex: '#64748b',
  },
};

export const INITIAL_EVENTS: CalendarEvent[] = [];

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr ? minutesStr.padStart(2, '0') : '00';
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatDatePretty(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function calculateDaysBetween(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr || !endDateStr || endDateStr <= startDateStr) return 1;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
}

export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatEventDateRange(startDateStr: string, endDateStr?: string, isMultiDay?: boolean): string {
  if (!startDateStr) return '';
  if (!endDateStr || endDateStr === startDateStr) {
    return formatDatePretty(startDateStr);
  }
  if (isMultiDay === false) {
    return `${formatDatePretty(startDateStr)} (ends ${formatDatePretty(endDateStr)})`;
  }
  const days = calculateDaysBetween(startDateStr, endDateStr);
  return `${formatDatePretty(startDateStr)} – ${formatDatePretty(endDateStr)} (${days} days)`;
}

export function getVisibleGridDateRange(currentMonthDate: Date): { startStr: string; endStr: string } {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  // Previous month padding days
  let startStr: string;
  if (firstDayOfMonth > 0) {
    const prevMonthDay = totalDaysInPrevMonth - firstDayOfMonth + 1;
    const prevMonthDate = new Date(year, month - 1, prevMonthDay);
    startStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;
  } else {
    startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }

  // Next month padding days to complete full 7-column rows
  const remainingCells = (7 - ((firstDayOfMonth + totalDaysInMonth) % 7)) % 7;
  let endStr: string;
  if (remainingCells > 0) {
    const nextMonthDate = new Date(year, month + 1, remainingCells);
    endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
  } else {
    endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;
  }

  return { startStr, endStr };
}


