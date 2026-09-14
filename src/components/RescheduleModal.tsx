import React, { useState } from 'react';
import { CalendarEvent } from '../types';
import { formatDatePretty, formatEventDateRange, calculateDaysBetween } from '../constants';
import { X, CalendarClock, AlertTriangle, CalendarRange } from 'lucide-react';

interface RescheduleModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  isTelegramConfigured: boolean;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  event,
  onClose,
  onSave,
  isTelegramConfigured,
}) => {
  if (!event) return null;

  const initialSpan = event.endDate ? calculateDaysBetween(event.date, event.endDate) : 1;
  const [newDate, setNewDate] = useState(event.date);
  const [isMultiDay, setIsMultiDay] = useState(initialSpan >= 3 ? true : (initialSpan === 2 ? Boolean(event.isMultiDay) : false));
  const [newEndDate, setNewEndDate] = useState(event.endDate || event.date);
  const [newStartTime, setNewStartTime] = useState(event.startTime);
  const [newEndTime, setNewEndTime] = useState(event.endTime);
  const [newLocation, setNewLocation] = useState(event.location);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedDate = newDate.trim();
    const trimmedEndDate = (newEndDate && newEndDate.trim()) || trimmedDate;

    if (trimmedEndDate < trimmedDate) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }

    const span = calculateDaysBetween(trimmedDate, trimmedEndDate);

    if (newStartTime && newEndTime) {
      if (trimmedEndDate === trimmedDate) {
        if (newStartTime >= newEndTime) {
          setError('Start Time must be strictly earlier than End Time for same-day events.');
          return;
        }
      } else {
        const startDt = new Date(`${trimmedDate}T${newStartTime}`);
        const endDt = new Date(`${trimmedEndDate}T${newEndTime}`);
        if (endDt <= startDt) {
          setError('End date and time must be strictly after start date and time.');
          return;
        }
      }
    }

    const effectiveIsMultiDay = span >= 3 ? true : (span === 2 ? isMultiDay : false);

    setSaving(true);
    try {
      await onSave(event.id, {
        date: trimmedDate,
        endDate: trimmedEndDate,
        isMultiDay: effectiveIsMultiDay,
        startTime: newStartTime,
        endTime: newEndTime,
        location: newLocation,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reschedule event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reschedule-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Reschedule Event
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {event.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-medium">
              {error}
            </div>
          )}

          {isTelegramConfigured && (
            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <span>
                Rescheduling will automatically dispatch an <strong>Important Scheduling Change Alert</strong> via Telegram to all subscribers.
              </span>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Current Schedule:</span> {formatEventDateRange(event.date, event.endDate)}
            {event.startTime ? ` from ${event.startTime} to ${event.endTime}` : ' (All Day / Untimed)'}
          </div>

          {/* Schedule Section */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                New Schedule & Timing
              </span>
              {calculateDaysBetween(newDate, newEndDate) > 1 && (
                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {calculateDaysBetween(newDate, newEndDate)} days total
                </span>
              )}
            </div>

            {/* Start Date & Start Time Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => {
                    const updatedStart = e.target.value;
                    setNewDate(updatedStart);
                    if (!newEndDate || newEndDate < updatedStart || newEndDate === newDate) {
                      setNewEndDate(updatedStart);
                      setIsMultiDay(false);
                    } else {
                      const newSpan = calculateDaysBetween(updatedStart, newEndDate);
                      if (newSpan >= 3) setIsMultiDay(true);
                      else if (newSpan <= 1) setIsMultiDay(false);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* End Date & End Time Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New End Date *
                </label>
                <input
                  type="date"
                  required
                  min={newDate}
                  value={newEndDate}
                  onChange={(e) => {
                    const updatedEnd = e.target.value;
                    setNewEndDate(updatedEnd);
                    const newSpan = calculateDaysBetween(newDate, updatedEnd);
                    if (newSpan >= 3) setIsMultiDay(true);
                    else if (newSpan <= 1) setIsMultiDay(false);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New End Time *
                </label>
                <input
                  type="time"
                  required
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Multi-day Setting for Spans >= 2 */}
            {calculateDaysBetween(newDate, newEndDate) >= 2 && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Multi-day Event Setting
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                    {calculateDaysBetween(newDate, newEndDate) >= 3 ? 'Required for 3+ Days' : 'Optional for 2 Days'}
                  </span>
                </div>

                <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={calculateDaysBetween(newDate, newEndDate) >= 3 ? true : isMultiDay}
                    disabled={calculateDaysBetween(newDate, newEndDate) >= 3}
                    onChange={(e) => {
                      if (calculateDaysBetween(newDate, newEndDate) === 2) {
                        setIsMultiDay(e.target.checked);
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Post as multi-day event spanning all {calculateDaysBetween(newDate, newEndDate)} days
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {calculateDaysBetween(newDate, newEndDate) >= 3
                        ? 'Required: Events spanning 3 or more calendar days are posted across every date with multi-day annotations.'
                        : isMultiDay
                        ? 'Checked: Will display across both days on the calendar with "Day 1 of 2" and "Day 2 of 2" indicators.'
                        : 'Unchecked: Will be posted only to the first day at its start time (e.g., overnight 10:00 PM – 2:00 AM).'}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Location / Virtual Link
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {saving ? 'Updating...' : 'Save & Publish Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
