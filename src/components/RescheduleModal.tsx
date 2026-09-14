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

  const [newDate, setNewDate] = useState(event.date);
  const [isMultiDay, setIsMultiDay] = useState(Boolean(event.isMultiDay || (event.endDate && event.endDate > event.date)));
  const [newEndDate, setNewEndDate] = useState(event.endDate || event.date);
  const [newStartTime, setNewStartTime] = useState(event.startTime);
  const [newEndTime, setNewEndTime] = useState(event.endTime);
  const [newLocation, setNewLocation] = useState(event.location);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isMultiDay && newEndDate < newDate) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }

    setSaving(true);
    try {
      await onSave(event.id, {
        date: newDate,
        endDate: isMultiDay && newEndDate > newDate ? newEndDate : undefined,
        isMultiDay: Boolean(isMultiDay && newEndDate > newDate),
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reschedule-modal-title" className="text-sm font-bold text-slate-900">
                Reschedule Event
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">
                {event.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          {isTelegramConfigured && (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                Rescheduling will automatically dispatch an <strong>Important Scheduling Change Alert</strong> via Telegram to all subscribers.
              </span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
            <span className="font-semibold text-slate-700">Current Schedule:</span> {formatEventDateRange(event.date, event.endDate)}
            {event.startTime ? ` from ${event.startTime} to ${event.endTime}` : ' (All Day / Untimed)'}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">
                {isMultiDay ? 'New Start Date *' : 'New Date *'}
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isMultiDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsMultiDay(checked);
                    if (checked && (!newEndDate || newEndDate < newDate)) {
                      setNewEndDate(newDate);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] font-semibold text-slate-600">Multi-day event</span>
              </label>
            </div>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => {
                const updatedStart = e.target.value;
                setNewDate(updatedStart);
                if (isMultiDay && newEndDate < updatedStart) {
                  setNewEndDate(updatedStart);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {isMultiDay && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                  New Multi-day Event Range
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                  {calculateDaysBetween(newDate, newEndDate)} days total
                </span>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-indigo-900 mb-1">
                  New End Date *
                </label>
                <input
                  type="date"
                  required
                  min={newDate}
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Start Time *
              </label>
              <input
                type="time"
                required
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New End Time *
              </label>
              <input
                type="time"
                required
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Location / Virtual Link
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              {saving ? 'Updating...' : 'Save & Publish Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
