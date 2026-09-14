import { RecurrenceRule, WeekOfMonth, DayOfWeek } from '../types';

export const WEEKDAYS = [
  { value: 0 as DayOfWeek, label: 'Sunday', short: 'Sun' },
  { value: 1 as DayOfWeek, label: 'Monday', short: 'Mon' },
  { value: 2 as DayOfWeek, label: 'Tuesday', short: 'Tue' },
  { value: 3 as DayOfWeek, label: 'Wednesday', short: 'Wed' },
  { value: 4 as DayOfWeek, label: 'Thursday', short: 'Thu' },
  { value: 5 as DayOfWeek, label: 'Friday', short: 'Fri' },
  { value: 6 as DayOfWeek, label: 'Saturday', short: 'Sat' },
];

export const WEEKS_OF_MONTH = [
  { value: 1 as WeekOfMonth, label: '1st' },
  { value: 2 as WeekOfMonth, label: '2nd' },
  { value: 3 as WeekOfMonth, label: '3rd' },
  { value: 4 as WeekOfMonth, label: '4th' },
  { value: -1 as WeekOfMonth, label: 'Last' },
];

export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calculates which week of the month a specific date falls on (1st, 2nd, 3rd, 4th, or Last)
 */
export function getWeekOfMonthForDate(date: Date): { weekOfMonth: WeekOfMonth; isLast: boolean } {
  const dayOfMonth = date.getDate();
  const weekIndex = Math.floor((dayOfMonth - 1) / 7) + 1;
  const weekOfMonth = (weekIndex > 4 ? 4 : weekIndex) as WeekOfMonth;

  // Check if it's also the last of that weekday in the month
  const nextWeekSameDay = new Date(date);
  nextWeekSameDay.setDate(date.getDate() + 7);
  const isLast = nextWeekSameDay.getMonth() !== date.getMonth();

  return { weekOfMonth, isLast };
}

/**
 * Returns the exact Date for the Nth weekday of a given year & month.
 * nth: 1=1st, 2=2nd, 3=3rd, 4=4th, -1=Last
 * dayOfWeek: 0=Sun ... 6=Sat
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number,
  nth: WeekOfMonth,
  dayOfWeek: DayOfWeek
): Date | null {
  if (nth === -1) {
    // Last occurrence of dayOfWeek in month
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let d = lastDayOfMonth.getDate();
    while (d > 0) {
      const candidate = new Date(year, month, d);
      if (candidate.getDay() === dayOfWeek) {
        return candidate;
      }
      d--;
    }
    return null;
  }

  // 1st, 2nd, 3rd, 4th
  const firstDayOfMonth = new Date(year, month, 1);
  const firstOccurrence = 1 + ((dayOfWeek - firstDayOfMonth.getDay() + 7) % 7);
  const targetDay = firstOccurrence + (nth - 1) * 7;
  const candidate = new Date(year, month, targetDay);

  if (candidate.getMonth() === month) {
    return candidate;
  }
  return null;
}

/**
 * Generates an array of formatted 'YYYY-MM-DD' dates according to the RecurrenceRule.
 */
export function calculateRecurringDates(startDateStr: string, rule: RecurrenceRule): string[] {
  if (!rule || rule.frequency === 'none') {
    return [startDateStr];
  }

  const startDate = parseDateLocal(startDateStr);
  const results: string[] = [];
  const maxOccurrences = Math.min(rule.occurrences || 12, 36); // Safety boundary
  const untilDate = rule.endType === 'until_date' && rule.untilDate ? parseDateLocal(rule.untilDate) : null;

  if (rule.frequency === 'monthly_weekday') {
    const nth = rule.weekOfMonth ?? 1;
    const dow = rule.dayOfWeek ?? (startDate.getDay() as DayOfWeek);
    const interval = Math.max(rule.interval || 1, 1);

    let currYear = startDate.getFullYear();
    let currMonth = startDate.getMonth();

    // Check if the current month's nth weekday is before startDate
    const currentMonthTarget = getNthWeekdayOfMonth(currYear, currMonth, nth, dow);
    if (currentMonthTarget && formatDateLocal(currentMonthTarget) >= startDateStr) {
      results.push(formatDateLocal(currentMonthTarget));
    }

    while (results.length < maxOccurrences) {
      currMonth += interval;
      while (currMonth > 11) {
        currMonth -= 12;
        currYear += 1;
      }

      const match = getNthWeekdayOfMonth(currYear, currMonth, nth, dow);
      if (match) {
        if (untilDate && match > untilDate) break;
        results.push(formatDateLocal(match));
      }
    }
  } else if (rule.frequency === 'monthly_date') {
    const targetDay = rule.dayOfMonth ?? startDate.getDate();
    const interval = Math.max(rule.interval || 1, 1);

    let currYear = startDate.getFullYear();
    let currMonth = startDate.getMonth();

    // If targetDay on current month is >= startDate.getDate(), include it
    const daysInStartMonth = new Date(currYear, currMonth + 1, 0).getDate();
    const clampedDay = Math.min(targetDay, daysInStartMonth);
    const firstDate = new Date(currYear, currMonth, clampedDay);
    if (formatDateLocal(firstDate) >= startDateStr) {
      results.push(formatDateLocal(firstDate));
    }

    while (results.length < maxOccurrences) {
      currMonth += interval;
      while (currMonth > 11) {
        currMonth -= 12;
        currYear += 1;
      }

      const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
      const actualDay = Math.min(targetDay, daysInMonth);
      const match = new Date(currYear, currMonth, actualDay);

      if (untilDate && match > untilDate) break;
      results.push(formatDateLocal(match));
    }
  } else if (rule.frequency === 'weekly') {
    const interval = Math.max(rule.interval || 1, 1);
    const targetDays = rule.daysOfWeek && rule.daysOfWeek.length > 0
      ? rule.daysOfWeek
      : [startDate.getDay() as DayOfWeek];

    // Sorted days
    const sortedDays = [...targetDays].sort((a, b) => a - b);

    let currDate = new Date(startDate);
    // Find the start of the current week (Sunday)
    let weekStart = new Date(currDate);
    weekStart.setDate(currDate.getDate() - currDate.getDay());

    while (results.length < maxOccurrences) {
      for (const dow of sortedDays) {
        const candidate = new Date(weekStart);
        candidate.setDate(weekStart.getDate() + dow);

        const candStr = formatDateLocal(candidate);
        if (candStr >= startDateStr) {
          if (untilDate && candidate > untilDate) return results;
          if (!results.includes(candStr)) {
            results.push(candStr);
            if (results.length >= maxOccurrences) return results;
          }
        }
      }
      weekStart.setDate(weekStart.getDate() + 7 * interval);
    }
  } else if (rule.frequency === 'daily') {
    const interval = Math.max(rule.interval || 1, 1);
    let curr = new Date(startDate);

    while (results.length < maxOccurrences) {
      const candStr = formatDateLocal(curr);
      if (untilDate && curr > untilDate) break;
      results.push(candStr);
      curr.setDate(curr.getDate() + interval);
    }
  } else if (rule.frequency === 'yearly') {
    const interval = Math.max(rule.interval || 1, 1);
    let currYear = startDate.getFullYear();
    const month = startDate.getMonth();
    const day = startDate.getDate();

    while (results.length < maxOccurrences) {
      const match = new Date(currYear, month, day);
      if (untilDate && match > untilDate) break;
      results.push(formatDateLocal(match));
      currYear += interval;
    }
  } else if (rule.frequency === 'custom') {
    // Custom handles custom selection
    const interval = Math.max(rule.interval || 1, 1);
    if (rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
      // Monthly by nth weekday custom interval
      let currYear = startDate.getFullYear();
      let currMonth = startDate.getMonth();

      const match = getNthWeekdayOfMonth(currYear, currMonth, rule.weekOfMonth, rule.dayOfWeek);
      if (match && formatDateLocal(match) >= startDateStr) {
        results.push(formatDateLocal(match));
      }

      while (results.length < maxOccurrences) {
        currMonth += interval;
        while (currMonth > 11) {
          currMonth -= 12;
          currYear += 1;
        }
        const m = getNthWeekdayOfMonth(currYear, currMonth, rule.weekOfMonth, rule.dayOfWeek);
        if (m) {
          if (untilDate && m > untilDate) break;
          results.push(formatDateLocal(m));
        }
      }
    } else if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      // Weekly custom days
      const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
      let weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() - startDate.getDay());

      while (results.length < maxOccurrences) {
        for (const dow of sortedDays) {
          const candidate = new Date(weekStart);
          candidate.setDate(weekStart.getDate() + dow);
          const candStr = formatDateLocal(candidate);
          if (candStr >= startDateStr) {
            if (untilDate && candidate > untilDate) return results;
            if (!results.includes(candStr)) {
              results.push(candStr);
              if (results.length >= maxOccurrences) return results;
            }
          }
        }
        weekStart.setDate(weekStart.getDate() + 7 * interval);
      }
    } else {
      // Monthly date
      const targetDay = rule.dayOfMonth ?? startDate.getDate();
      let currYear = startDate.getFullYear();
      let currMonth = startDate.getMonth();

      while (results.length < maxOccurrences) {
        const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
        const actualDay = Math.min(targetDay, daysInMonth);
        const match = new Date(currYear, currMonth, actualDay);

        if (formatDateLocal(match) >= startDateStr) {
          if (untilDate && match > untilDate) break;
          results.push(formatDateLocal(match));
        }

        currMonth += interval;
        while (currMonth > 11) {
          currMonth -= 12;
          currYear += 1;
        }
      }
    }
  }

  // Ensure at least one date is returned if no future matches were found
  if (results.length === 0) {
    results.push(startDateStr);
  }

  return results.slice(0, maxOccurrences);
}

/**
 * Produces a human-friendly string summarizing the recurrence rule.
 */
export function formatRecurrenceLabel(rule: RecurrenceRule): string {
  if (!rule || rule.frequency === 'none') {
    return 'Does not repeat';
  }

  let base = '';
  const interval = rule.interval || 1;

  switch (rule.frequency) {
    case 'monthly_weekday': {
      const nthLabel = WEEKS_OF_MONTH.find((w) => w.value === rule.weekOfMonth)?.label || '1st';
      const dayLabel = WEEKDAYS.find((d) => d.value === rule.dayOfWeek)?.label || 'Friday';
      if (interval === 1) {
        base = `Every ${nthLabel} ${dayLabel} of the month`;
      } else {
        base = `Every ${interval} months on the ${nthLabel} ${dayLabel}`;
      }
      break;
    }
    case 'monthly_date': {
      const day = rule.dayOfMonth || 1;
      const suffix = getDayOrdinal(day);
      if (interval === 1) {
        base = `Every month on the ${day}${suffix}`;
      } else {
        base = `Every ${interval} months on the ${day}${suffix}`;
      }
      break;
    }
    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayNames = rule.daysOfWeek
          .map((d) => WEEKDAYS.find((w) => w.value === d)?.short || '')
          .filter(Boolean)
          .join(', ');
        base = interval === 1 ? `Weekly on ${dayNames}` : `Every ${interval} weeks on ${dayNames}`;
      } else {
        const dayLabel = WEEKDAYS.find((d) => d.value === rule.dayOfWeek)?.label || 'Friday';
        base = interval === 1 ? `Weekly on ${dayLabel}` : `Every ${interval} weeks on ${dayLabel}`;
      }
      break;
    }
    case 'daily': {
      base = interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;
    }
    case 'yearly': {
      base = interval === 1 ? 'Every year on this date' : `Every ${interval} years`;
      break;
    }
    case 'custom': {
      if (rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
        const nthLabel = WEEKS_OF_MONTH.find((w) => w.value === rule.weekOfMonth)?.label || '1st';
        const dayLabel = WEEKDAYS.find((d) => d.value === rule.dayOfWeek)?.label || 'day';
        base = interval === 1 ? `Every ${nthLabel} ${dayLabel} of the month` : `Every ${interval} months on the ${nthLabel} ${dayLabel}`;
      } else if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayNames = rule.daysOfWeek
          .map((d) => WEEKDAYS.find((w) => w.value === d)?.short || '')
          .join(', ');
        base = `Every ${interval} week(s) on ${dayNames}`;
      } else {
        base = `Custom schedule (every ${interval} interval)`;
      }
      break;
    }
    default:
      base = 'Custom repeat';
  }

  // Append end description
  if (rule.endType === 'occurrences') {
    base += ` (${rule.occurrences || 6} times)`;
  } else if (rule.endType === 'until_date' && rule.untilDate) {
    base += ` (until ${rule.untilDate})`;
  }

  return base;
}

export function getDayOrdinal(d: number): string {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
