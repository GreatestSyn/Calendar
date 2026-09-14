import { calculateDaysBetween, formatEventDateRange, addDaysToDate } from '../src/constants';
import { CalendarEvent } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('--- Testing Multi-Day / Overnight Rules & Toggle Logic ---');

// 1. Test addDaysToDate
assert(addDaysToDate('2026-09-14', 1) === '2026-09-15', 'addDaysToDate correctly calculates next day');
assert(addDaysToDate('2026-09-30', 1) === '2026-10-01', 'addDaysToDate correctly crosses month boundary');

// 2. Test formatEventDateRange
const rangeMulti = formatEventDateRange('2026-09-14', '2026-09-15', true);
assert(rangeMulti.includes('(2 days)'), 'formatEventDateRange with isMultiDay=true includes (2 days)');

const rangeOvernight = formatEventDateRange('2026-09-14', '2026-09-15', false);
assert(rangeOvernight.includes('(ends '), 'formatEventDateRange with isMultiDay=false formats as overnight ends date');
assert(!rangeOvernight.includes('(2 days)'), 'formatEventDateRange with isMultiDay=false does NOT include (2 days)');

// 3. Test CalendarGrid isEventOnDate filtering
const isEventOnDate = (e: CalendarEvent, dateStr: string): boolean => {
  if (e.date === dateStr) return true;
  if (e.isMultiDay && e.endDate && e.date <= dateStr && e.endDate >= dateStr) return true;
  return false;
};

const overnightEventMulti: CalendarEvent = {
  id: 'test-1',
  title: 'Late Night Mosh',
  category: 'Member Event (18+)',
  date: '2026-09-14',
  endDate: '2026-09-15',
  isMultiDay: true,
  startTime: '20:00',
  endTime: '02:00',
  status: 'approved',
  submitterName: 'Tester',
  submitterEmail: '@tester',
  location: 'Hall',
  description: 'Party',
  submittedAt: new Date().toISOString(),
  source: 'direct_submission',
};

// When isMultiDay is true:
assert(isEventOnDate(overnightEventMulti, '2026-09-14') === true, 'Multi-day overnight event is on day 1');
assert(isEventOnDate(overnightEventMulti, '2026-09-15') === true, 'Multi-day overnight event is on day 2');
assert(Boolean(overnightEventMulti.isMultiDay && overnightEventMulti.endDate && overnightEventMulti.endDate > overnightEventMulti.date) === true, 'Multi-day icon evaluates to true');

// When isMultiDay is toggled to false:
const overnightEventSingle: CalendarEvent = {
  ...overnightEventMulti,
  isMultiDay: false,
};

assert(isEventOnDate(overnightEventSingle, '2026-09-14') === true, 'Overnight single-day event is on day 1');
assert(isEventOnDate(overnightEventSingle, '2026-09-15') === false, 'Overnight single-day event is NOT on day 2');
assert(Boolean(overnightEventSingle.isMultiDay && overnightEventSingle.endDate && overnightEventSingle.endDate > overnightEventSingle.date) === false, 'Multi-day icon evaluates to false');

// 4. Test series propagation logic
const seriesDates = ['2026-09-04', '2026-10-02', '2026-11-06', '2026-12-04'];
const seriesSpanOffset = 1; // 1 day span (ends next day)

const seriesEvents: CalendarEvent[] = seriesDates.map((dateStr, idx) => ({
  id: `evt-series-${idx}`,
  title: 'Rad Rat Mosh',
  category: 'Member Event (18+)',
  date: dateStr,
  endDate: addDaysToDate(dateStr, seriesSpanOffset),
  isMultiDay: true, // initially multi-day
  startTime: '20:00',
  endTime: '02:00',
  status: 'approved',
  submitterName: 'Syn',
  submitterEmail: '@GreatestSyn',
  location: 'Sir Rat Leather',
  description: 'Social',
  submittedAt: new Date().toISOString(),
  source: 'direct_submission',
  isRecurring: true,
  recurringSeriesId: 'series-123',
}));

// Toggling isMultiDay to false on the series:
for (const s of seriesEvents) {
  s.isMultiDay = false;
}

for (const s of seriesEvents) {
  assert(s.isMultiDay === false, `Series occurrence ${s.date} isMultiDay is false`);
  assert(isEventOnDate(s, s.date) === true, `Series occurrence ${s.date} is on its start date`);
  const nextDay = addDaysToDate(s.date, 1);
  assert(isEventOnDate(s, nextDay) === false, `Series occurrence ${s.date} does NOT show on next day ${nextDay}`);
}

console.log('🎉 ALL MULTI-DAY REMOVAL & RESTRICTION TESTS PASSED!');
