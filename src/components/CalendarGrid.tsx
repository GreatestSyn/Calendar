import React from 'react';
import { CalendarEvent } from '../types';
import { CATEGORIES, formatTime12h } from '../constants';
import { Clock, Repeat, CalendarRange } from 'lucide-react';

interface CalendarGridProps {
  currentMonthDate: Date;
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const isEventOnDate = (e: CalendarEvent, dateStr: string): boolean => {
  if (e.date === dateStr) return true;
  if (e.endDate && e.date <= dateStr && e.endDate >= dateStr) return true;
  return false;
};

const WEEKDAYS = [
  { short: 'Sun', full: 'Sunday' },
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
];

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonthDate,
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
}) => {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // First day of month & total days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  // Today in YYYY-MM-DD
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  // Build grid days
  const gridCells: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEvent[];
  }[] = [];

  // Previous month padding days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = totalDaysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => isEventOnDate(e, dateStr));
    gridCells.push({
      dayNumber: dayNum,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => isEventOnDate(e, dateStr));
    gridCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  // Next month padding to finish 7-column grid
  const remainingCells = (7 - (gridCells.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDate = new Date(year, month + 1, day);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => isEventOnDate(e, dateStr));
    gridCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  return (
    <div
      id="calendar-grid-container"
      className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden"
      role="region"
      aria-label="Calendar month grid"
    >
      {/* Weekday headers */}
      <div
        className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-semibold text-xs text-center py-2.5"
        role="row"
      >
        {WEEKDAYS.map((wd) => (
          <div key={wd.full} role="columnheader" aria-label={wd.full} className="tracking-wide">
            <span className="hidden sm:inline">{wd.full}</span>
            <span className="sm:hidden">{wd.short}</span>
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-100 dark:bg-slate-800/80"
        role="grid"
        aria-label="Monthly dates"
      >
        {gridCells.map((cell) => {
          const isSelected = selectedDate === cell.dateStr;
          const hasEvents = cell.events.length > 0;
          const readableDate = new Date(cell.dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div
              key={cell.dateStr}
              role="gridcell"
              tabIndex={0}
              aria-selected={isSelected}
              aria-label={`${readableDate}${hasEvents ? `. ${cell.events.length} events scheduled.` : '. No events scheduled.'}`}
              onClick={() => onSelectDate(cell.dateStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDate(cell.dateStr);
                }
              }}
              className={`min-h-[110px] sm:min-h-[125px] p-1.5 sm:p-2 transition-all flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 ${
                cell.isCurrentMonth
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-slate-50/70 dark:bg-slate-950/50 text-slate-400 dark:text-slate-600'
              } ${
                isSelected
                  ? 'ring-2 ring-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              {/* Top Row: Day Number & Event count indicator */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 transition-colors ${
                    cell.isToday
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : isSelected
                      ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200 font-bold'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {hasEvents && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:hidden px-1 rounded bg-slate-100 dark:bg-slate-800">
                    {cell.events.length}
                  </span>
                )}
              </div>

              {/* Event Titles List: Color coded and clickable */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden" role="list">
                {cell.events.slice(0, 3).map((event) => {
                  const categoryMeta = CATEGORIES[event.category] || CATEGORIES.other;
                  const isPending = event.status === 'pending';

                  return (
                    <button
                      key={event.id}
                      role="listitem"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      title={`${event.title}${event.isMultiDay ? ' (Multi-day)' : ''}${event.startTime ? ` (${formatTime12h(event.startTime)})` : ' (All Day)'} - Click for full details`}
                      className={`group w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-md border transition-all truncate flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isPending
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/50'
                          : `${categoryMeta.bgLight} ${categoryMeta.textClass} ${categoryMeta.borderClass} hover:brightness-95 dark:hover:brightness-110`
                      }`}
                      aria-label={`Event: ${event.title}, ${categoryMeta.label}${event.isMultiDay ? ', Multi-day event' : ''}${event.startTime ? `, from ${formatTime12h(event.startTime)} to ${formatTime12h(event.endTime)}` : ', All-day announcement'}${isPending ? ', Pending admin approval' : ''}`}
                    >
                      {/* Dot or Pending clock */}
                      {isPending ? (
                        <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${categoryMeta.dotClass}`}
                          aria-hidden="true"
                        />
                      )}

                      {/* Event Title */}
                      <span className="truncate font-semibold flex-1">
                        {event.title}
                      </span>

                      {/* Multi-day Indicator */}
                      {(event.isMultiDay || (event.endDate && event.endDate > event.date)) && (
                        <CalendarRange
                          className="w-2.5 h-2.5 opacity-75 shrink-0 text-indigo-500 dark:text-indigo-400"
                          aria-label="Multi-day event"
                        />
                      )}

                      {/* Recurrence Indicator */}
                      {(event.isRecurring || event.recurringSeriesId) && (
                        <Repeat
                          className="w-2.5 h-2.5 opacity-70 shrink-0 text-slate-500 dark:text-slate-400"
                          aria-label={`Recurring event: ${event.recurrenceRule?.humanReadable || 'Series'}`}
                        />
                      )}

                      {/* Small Time Badge on Larger Screens */}
                      <span className="hidden xl:inline text-[9px] opacity-75 font-normal shrink-0">
                        {event.startTime || (event.isMultiDay ? 'Multi-day' : 'All Day')}
                      </span>
                    </button>
                  );
                })}

                {/* More events badge */}
                {cell.events.length > 3 && (
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1 pt-0.5">
                    +{cell.events.length - 3} more
                  </div>
                )}
              </div>

              {/* Accessible Day Itinerary prompt on hover/focus */}
              <div className="sr-only">
                Click to view day itinerary for {readableDate}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
