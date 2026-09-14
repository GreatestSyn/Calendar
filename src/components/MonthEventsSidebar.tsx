import React, { useState } from 'react';
import { CalendarEvent } from '../types';
import { CATEGORIES, formatTime12h, formatDatePretty, formatEventDateRange } from '../constants';
import { Calendar, Clock, MapPin, CheckCircle, Hourglass, ArrowRight, CalendarRange } from 'lucide-react';

interface MonthEventsSidebarProps {
  currentMonthDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDate: (dateStr: string) => void;
}

export const MonthEventsSidebar: React.FC<MonthEventsSidebarProps> = ({
  currentMonthDate,
  events,
  onSelectEvent,
  onSelectDate,
}) => {
  const [groupBy, setGroupBy] = useState<'date' | 'category'>('date');

  const monthYearStr = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Filter events to only this month (including multi-day spans that overlap this month)
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth() + 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const monthEvents = events
    .filter((e) => {
      if (e.date >= monthStartStr && e.date <= monthEndStr) return true;
      if (e.isMultiDay && e.endDate && e.date <= monthEndStr && e.endDate >= monthStartStr) return true;
      return false;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

  // Count by category
  const categoryCounts = monthEvents.reduce((acc, evt) => {
    acc[evt.category] = (acc[evt.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <aside
      aria-label={`Events occurring in ${monthYearStr}`}
      className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {monthYearStr} Schedule
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300">
            {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {/* Group By selector */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
          <span className="font-medium">Group list by:</span>
          <div className="inline-flex rounded-md bg-slate-200/80 dark:bg-slate-800 p-0.5" role="tablist">
            <button
              role="tab"
              aria-selected={groupBy === 'date'}
              onClick={() => setGroupBy('date')}
              className={`px-2 py-0.5 font-medium rounded text-[11px] transition-colors ${
                groupBy === 'date'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Date
            </button>
            <button
              role="tab"
              aria-selected={groupBy === 'category'}
              onClick={() => setGroupBy('category')}
              className={`px-2 py-0.5 font-medium rounded text-[11px] transition-colors ${
                groupBy === 'category'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Category
            </button>
          </div>
        </div>

        {/* Color-Coded Category Legend Badges */}
        <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          {Object.entries(categoryCounts).map(([catId, count]) => {
            const meta = CATEGORIES[catId as keyof typeof CATEGORIES] || CATEGORIES.other;
            return (
              <span
                key={catId}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${meta.bgLight} ${meta.textClass} border ${meta.borderClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                {meta.label.split(' ')[0]}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60" role="list">
        {monthEvents.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-700">No events for this month</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Events submitted via Google Forms will appear here in real-time.
            </p>
          </div>
        ) : groupBy === 'date' ? (
          monthEvents.map((evt) => {
            const meta = CATEGORIES[evt.category] || CATEGORIES.other;
            const isPending = evt.status === 'pending';

            return (
              <article
                key={evt.id}
                role="listitem"
                className="pt-2 first:pt-0"
              >
                <div
                  onClick={() => onSelectEvent(evt)}
                  className={`group p-2.5 rounded-lg border transition-all cursor-pointer hover:shadow-xs ${
                    isPending
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50/60 dark:hover:bg-slate-800'
                  }`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectEvent(evt);
                    }
                  }}
                  aria-label={`Event: ${evt.title}, ${formatDatePretty(evt.date)}, ${formatTime12h(evt.startTime)}. Click for full details.`}
                >
                  {/* Category Pill & Status */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                      {meta.label}
                    </span>

                    {isPending ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                        <Hourglass className="w-2.5 h-2.5" />
                        Pending Approval
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="w-2.5 h-2.5" /> Approved
                      </span>
                    )}
                  </div>

                  {/* Title (Color coded left border or hover highlight) */}
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {evt.title}
                  </h3>

                  {/* Date & Time */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(evt.date);
                      }}
                      className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline inline-flex items-center gap-1 text-left"
                      title="View day itinerary"
                    >
                      {(evt.isMultiDay && evt.endDate && evt.endDate > evt.date) ? (
                        <CalendarRange className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                      <span>
                        {(evt.isMultiDay && evt.endDate && evt.endDate > evt.date)
                          ? formatEventDateRange(evt.date, evt.endDate)
                          : formatDatePretty(evt.date)}
                      </span>
                    </button>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evt.startTime ? formatTime12h(evt.startTime) : (evt.category === 'celebration' ? 'All Day' : 'Untimed')}
                    </span>
                  </div>

                  {/* Location snippet */}
                  {evt.location && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.location}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          // Grouped by Category
          Object.values(CATEGORIES).map((cat) => {
            const catEvents = monthEvents.filter((e) => e.category === cat.id);
            if (catEvents.length === 0) return null;

            return (
              <section key={cat.id} className="pt-2 first:pt-0" aria-label={cat.label}>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${cat.textClass}`}>
                    <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} />
                    {cat.label}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {catEvents.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {catEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className="p-2 bg-white dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate">
                        {evt.title}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="truncate pr-1">{formatEventDateRange(evt.date, evt.endDate)}</span>
                        <span className="shrink-0">{evt.startTime ? formatTime12h(evt.startTime) : (evt.category === 'celebration' ? 'All Day' : 'Untimed')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Footer quick link */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Click any event title to view full Google Form responses
        </p>
      </div>
    </aside>
  );
};
