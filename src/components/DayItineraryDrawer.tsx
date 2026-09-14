import React, { useEffect, useState } from 'react';
import { CalendarEvent } from '../types';
import { CATEGORIES, formatTime12h, formatDatePretty, calculateDaysBetween, formatEventDateRange } from '../constants';
import {
  X,
  Clock,
  MapPin,
  User,
  Plus,
  Calendar as CalendarIcon,
  ChevronRight,
  Hourglass,
  CheckCircle2,
  Download,
  CalendarPlus,
  CalendarRange,
} from 'lucide-react';
import { downloadIcsFile, downloadMultipleEventsIcs } from '../utils/calendarExport';

interface DayItineraryDrawerProps {
  selectedDate: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEventForDate: (dateStr: string) => void;
}

export const DayItineraryDrawer: React.FC<DayItineraryDrawerProps> = ({
  selectedDate,
  events,
  onClose,
  onSelectEvent,
  onAddEventForDate,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selectedDate) return null;

  // Filter and sort events for this day (including multi-day spans)
  const dayEvents = events
    .filter((e) => {
      if (e.date === selectedDate) return true;
      if (e.endDate && e.date <= selectedDate && e.endDate >= selectedDate) return true;
      return false;
    })
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="itinerary-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
              <CalendarIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="itinerary-title" className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                Day Itinerary
              </h2>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {formatDatePretty(selectedDate)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close itinerary panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
            {dayEvents.length} {dayEvents.length === 1 ? 'event scheduled' : 'events scheduled'}
          </span>
          <div className="flex items-center gap-2">
            {dayEvents.length > 0 && (
              <button
                type="button"
                onClick={() => downloadMultipleEventsIcs(dayEvents, `itinerary_${selectedDate}.ics`, `Schedule for ${selectedDate}`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 shadow-2xs transition-colors"
                title="Download this entire day's schedule to your calendar (.ics)"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Export Day (.ics)</span>
              </button>
            )}
            <button
              onClick={() => onAddEventForDate(selectedDate)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event</span>
            </button>
          </div>
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" role="list">
          {dayEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No events on this date</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                There are no meetings or activities scheduled for {formatDatePretty(selectedDate)}.
              </p>
              <button
                onClick={() => onAddEventForDate(selectedDate)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule New Event</span>
              </button>
            </div>
          ) : (
            dayEvents.map((event, index) => {
              const meta = CATEGORIES[event.category] || CATEGORIES.other;
              const isPending = event.status === 'pending';
              const isEventMultiDay = Boolean(event.isMultiDay || (event.endDate && event.endDate > event.date));
              const totalDays = event.endDate ? calculateDaysBetween(event.date, event.endDate) : 1;
              const currentDayNumber = calculateDaysBetween(event.date, selectedDate);

              return (
                <div
                  key={event.id}
                  role="listitem"
                  className="relative pl-6 border-l-2 border-indigo-200 dark:border-indigo-900/50 last:border-transparent pb-2"
                >
                  {/* Timeline dot */}
                  <span
                    className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${
                      isPending ? 'bg-amber-500' : meta.dotClass
                    }`}
                    aria-hidden="true"
                  />

                  {/* Card */}
                  <div
                    onClick={() => onSelectEvent(event)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                      isPending
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'
                    }`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectEvent(event);
                      }
                    }}
                    aria-label={`Event: ${event.title}, click to view full Google Form submission details`}
                  >
                    {/* Time & Category */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>
                          {event.startTime
                            ? `${formatTime12h(event.startTime)} - ${formatTime12h(event.endTime)}`
                            : (event.category === 'celebration' ? 'All Day Celebration' : 'Untimed')}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                    </div>

                    {/* Multi-day Span Indicator */}
                    {isEventMultiDay && (
                      <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        <CalendarRange className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        <span>Day {currentDayNumber} of {totalDays}</span>
                        <span className="text-indigo-400 font-normal">({formatEventDateRange(event.date, event.endDate)})</span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-1">
                      {event.title}
                    </h3>

                    {/* Description snippet */}
                    {event.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                        {event.description}
                      </p>
                    )}

                    {/* Meta Footer: Location, Submitter, Status */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <User className="w-3 h-3 text-slate-400" />
                          {event.submitterName}
                        </span>

                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                            <Hourglass className="w-3 h-3" /> Awaiting Approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action prompts */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadIcsFile(event);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors"
                        title="Download to personal calendar (.ics)"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>Add to Calendar</span>
                      </button>

                      <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-800 dark:hover:text-indigo-300 gap-0.5">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
