import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventCategory, RecurrenceRule } from '../types';
import { CATEGORIES, calculateDaysBetween } from '../constants';
import { X, CalendarPlus, CheckCircle2, Sparkles, Clock, Repeat, CalendarRange } from 'lucide-react';
import { submitEventDirect } from '../services/api';
import { RecurrenceSelector } from './RecurrenceSelector';

interface SubmitEventModalProps {
  initialDate?: string | null;
  onClose: () => void;
  onEventCreated: (event: CalendarEvent, series?: CalendarEvent[]) => void;
}

export const SubmitEventModal: React.FC<SubmitEventModalProps> = ({
  initialDate,
  onClose,
  onEventCreated,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('SAKK Event');
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [isAllDayCelebration, setIsAllDayCelebration] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [equipmentNeeds, setEquipmentNeeds] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCelebration = category === 'celebration';

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // When switching to celebration, if times were untouched or user wants an announcement
  useEffect(() => {
    if (category === 'celebration' && startTime === '10:00' && endTime === '11:00') {
      // User just switched to celebration; default to all-day announcement optional time
      setIsAllDayCelebration(true);
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedDate = date.trim();
    const trimmedName = submitterName.trim();
    let trimmedHandle = submitterEmail.trim();
    if (trimmedHandle && !trimmedHandle.startsWith('@') && !trimmedHandle.includes('@')) {
      trimmedHandle = `@${trimmedHandle}`;
    }
    const trimmedLocation = location.trim();
    const trimmedDesc = description.trim();

    // Conditional Validation Rules
    if (isCelebration) {
      if (!trimmedTitle) {
        setError('Event Title is required for celebration events.');
        setSubmitting(false);
        return;
      }
      if (!trimmedDate) {
        setError('Scheduled Date is required for celebration events.');
        setSubmitting(false);
        return;
      }
      // Times are optional for celebration: only validate if both provided and not all-day
      const finalStartTime = isAllDayCelebration ? '' : startTime.trim();
      const finalEndTime = isAllDayCelebration ? '' : endTime.trim();
      if (finalStartTime && finalEndTime && finalStartTime >= finalEndTime) {
        setError('Start time must be earlier than End time.');
        setSubmitting(false);
        return;
      }
    } else {
      // Standard strict validation for non-celebration events
      if (!trimmedTitle || !trimmedDate || !trimmedName || !trimmedHandle || !trimmedLocation || !trimmedDesc) {
        setError('Please fill out all required fields: Title, Category, Date, Start Time, End Time, Preferred Name, Telegram Handle, Location, and Description.');
        setSubmitting(false);
        return;
      }
      if (!startTime || !endTime) {
        setError('Start Time and End Time are required.');
        setSubmitting(false);
        return;
      }
      if (startTime >= endTime) {
        setError('Start Time must be strictly earlier than End Time.');
        setSubmitting(false);
        return;
      }
    }

    // Multi-day Date Range Validation
    if (isMultiDay && endDate < trimmedDate) {
      setError('End Date cannot be earlier than Start Date for multi-day events.');
      setSubmitting(false);
      return;
    }

    const effectiveStartTime = isCelebration && isAllDayCelebration ? '' : startTime.trim();
    const effectiveEndTime = isCelebration && isAllDayCelebration ? '' : endTime.trim();

    try {
      const res = await submitEventDirect({
        title: trimmedTitle,
        category,
        date: trimmedDate,
        endDate: isMultiDay && endDate > trimmedDate ? endDate : undefined,
        isMultiDay: Boolean(isMultiDay && endDate > trimmedDate),
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        submitterName: trimmedName || (isCelebration ? 'Celebration Announcement' : 'Member'),
        submitterEmail: trimmedHandle || (isCelebration ? '@community' : '@member'),
        location: trimmedLocation || (isCelebration ? 'Celebration / Community' : 'Online / TBD'),
        description: trimmedDesc || (isCelebration ? 'Celebration / Anniversary Announcement' : ''),
        expectedAttendees: expectedAttendees.trim(),
        equipmentNeeds: equipmentNeeds.trim(),
        recurrenceRule: recurrenceRule || undefined,
      });

      onEventCreated(res.event, res.series);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="submit-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Submit Calendar Event
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New submissions are queued for administrator review
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80">
              {error}
            </div>
          )}

          {/* Celebration Informational Note */}
          {isCelebration && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-xs">Celebration / Anniversary Announcement Mode</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Only the <strong>Title</strong>, <strong>Category</strong>, and <strong>Date</strong> are required. Times, location, and submitter info are optional if you just want to announce an anniversary or milestone.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isCelebration ? 'e.g., SAKK 10th Anniversary Celebration' : 'e.g., Annual Strategy Review'}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {Object.values(CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {isMultiDay ? 'Start Date *' : 'Scheduled Date *'}
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isMultiDay}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsMultiDay(checked);
                      if (checked && (!endDate || endDate < date)) {
                        setEndDate(date);
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Multi-day</span>
                </label>
              </div>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setDate(newStart);
                  if (isMultiDay && endDate < newStart) {
                    setEndDate(newStart);
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Multi-day Event Range Selection */}
          {isMultiDay && (
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Multi-day Event Range
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {calculateDaysBetween(date, endDate)} day{calculateDaysBetween(date, endDate) === 1 ? '' : 's'} total
                </span>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-indigo-900 dark:text-indigo-300 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  min={date}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Time Selection */}
          {isCelebration ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Event Timing <span className="text-slate-400 font-normal">(Optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAllDayCelebration(!isAllDayCelebration)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    isAllDayCelebration
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {isAllDayCelebration ? '✓ All-Day Announcement' : 'Set Specific Hours'}
                </button>
              </div>

              {!isAllDayCelebration && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Recurring Schedule Option */}
          <RecurrenceSelector
            baseDate={date}
            rule={recurrenceRule}
            onChange={setRecurrenceRule}
          />

          {/* Submitter Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Name {isCelebration ? <span className="text-slate-400 font-normal">(Optional)</span> : '*'}
              </label>
              <input
                type="text"
                required={!isCelebration}
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder={isCelebration ? 'Optional (e.g. Alex Rivera)' : 'e.g., Alex Rivera'}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Handle {isCelebration ? <span className="text-slate-400 font-normal">(Optional)</span> : '*'}
              </label>
              <input
                type="text"
                required={!isCelebration}
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder={isCelebration ? 'Optional (e.g. @alex_sakk)' : 'e.g., @alex_sakk'}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Location / Virtual Meeting Link {isCelebration ? <span className="text-slate-400 font-normal">(Optional)</span> : '*'}
            </label>
            <input
              type="text"
              required={!isCelebration}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={isCelebration ? 'Optional (e.g. Main Hall or leave empty for general announcement)' : 'e.g., Main Community Hall 204 or https://meet.google.com/...'}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Event Description {isCelebration ? <span className="text-slate-400 font-normal">(Optional)</span> : '*'}
            </label>
            <textarea
              rows={2}
              required={!isCelebration}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isCelebration ? 'Optional celebration details or anniversary milestone announcement...' : 'Outline objectives, agendas, or background details...'}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected Attendees <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={expectedAttendees}
                onChange={(e) => setExpectedAttendees(e.target.value)}
                placeholder="e.g., 20 people"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Equipment Needs <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={equipmentNeeds}
                onChange={(e) => setEquipmentNeeds(e.target.value)}
                placeholder="e.g., Projector, mic"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit for Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
