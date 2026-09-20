import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventCategory, RecurrenceRule } from '../types';
import { CATEGORIES, calculateDaysBetween, addDaysToDate, formatTime12h } from '../constants';
import { X, CalendarPlus, CheckCircle2, Sparkles, Clock, Repeat, CalendarRange, Image as ImageIcon } from 'lucide-react';
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
  const [flyerUrl, setFlyerUrl] = useState('');
  const [description, setDescription] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [equipmentNeeds, setEquipmentNeeds] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCelebration = category === 'celebration';

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
      setEndDate(initialDate);
    }
  }, [initialDate]);

  const spanDays = calculateDaysBetween(date, endDate);

  const handleStartDateChange = (newStart: string) => {
    setDate(newStart);
    if (!endDate || endDate < newStart || endDate === date) {
      setEndDate(newStart);
      setIsMultiDay(false);
    } else {
      const newSpan = calculateDaysBetween(newStart, endDate);
      if (newSpan >= 3) {
        setIsMultiDay(true);
      } else if (newSpan <= 1) {
        setIsMultiDay(false);
      }
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    const newSpan = calculateDaysBetween(date, newEnd);
    if (newSpan >= 3) {
      setIsMultiDay(true);
    } else if (newSpan <= 1) {
      setIsMultiDay(false);
    }
  };

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
    const trimmedEndDate = (endDate && endDate.trim()) || trimmedDate;
    const trimmedName = submitterName.trim();
    let trimmedHandle = submitterEmail.trim();
    if (trimmedHandle && !trimmedHandle.startsWith('@') && !trimmedHandle.includes('@')) {
      trimmedHandle = `@${trimmedHandle}`;
    }
    const trimmedLocation = location.trim();
    const trimmedDesc = description.trim();
    const trimmedFlyer = flyerUrl.trim();

    if (trimmedFlyer && /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\//i.test(trimmedFlyer)) {
      setError('Instagram post links cannot be used directly because Meta blocks external crawlers. Please provide a direct image URL (e.g. right-click the image on desktop and select "Copy Image Address", or upload to an image host).');
      setSubmitting(false);
      return;
    }

    // End date cannot be before start date
    if (trimmedEndDate < trimmedDate) {
      setError('End Date cannot be earlier than Start Date.');
      setSubmitting(false);
      return;
    }

    const currentSpanDays = calculateDaysBetween(trimmedDate, trimmedEndDate);
    const effectiveStartTime = isCelebration && isAllDayCelebration ? '' : startTime.trim();
    const effectiveEndTime = isCelebration && isAllDayCelebration ? '' : endTime.trim();

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
      // If times are provided for celebration, validate them
      if (effectiveStartTime && effectiveEndTime) {
        if (trimmedEndDate === trimmedDate) {
          if (effectiveStartTime >= effectiveEndTime) {
            setError('Start time must be strictly earlier than End time for same-day events.');
            setSubmitting(false);
            return;
          }
        } else {
          const startDt = new Date(`${trimmedDate}T${effectiveStartTime}`);
          const endDt = new Date(`${trimmedEndDate}T${effectiveEndTime}`);
          if (endDt <= startDt) {
            setError('End date and time must be strictly after start date and time.');
            setSubmitting(false);
            return;
          }
        }
      }
    } else {
      // Standard strict validation for non-celebration events
      if (!trimmedTitle || !trimmedDate || !trimmedName || !trimmedHandle || !trimmedLocation || !trimmedDesc) {
        setError('Please fill out all required fields: Title, Category, Start Date, Start Time, End Date, End Time, Preferred Name, Telegram Handle, Location, and Description.');
        setSubmitting(false);
        return;
      }
      if (!effectiveStartTime || !effectiveEndTime) {
        setError('Start Time and End Time are required.');
        setSubmitting(false);
        return;
      }
      if (trimmedEndDate === trimmedDate) {
        if (effectiveStartTime >= effectiveEndTime) {
          setError('Start Time must be strictly earlier than End Time for same-day events.');
          setSubmitting(false);
          return;
        }
      } else {
        const startDt = new Date(`${trimmedDate}T${effectiveStartTime}`);
        const endDt = new Date(`${trimmedEndDate}T${effectiveEndTime}`);
        if (endDt <= startDt) {
          setError('End date and time must be strictly after start date and time.');
          setSubmitting(false);
          return;
        }
      }
    }

    // Force multi-day if 3 or more days; allow toggle if 2 days; false if 1 day
    const effectiveIsMultiDay = currentSpanDays >= 3 ? true : (currentSpanDays === 2 ? isMultiDay : false);

    try {
      const res = await submitEventDirect({
        title: trimmedTitle,
        category,
        date: trimmedDate,
        endDate: trimmedEndDate,
        isMultiDay: effectiveIsMultiDay,
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        submitterName: trimmedName || (isCelebration ? 'Celebration Announcement' : 'Member'),
        submitterEmail: trimmedHandle || (isCelebration ? '@community' : '@member'),
        location: trimmedLocation || (isCelebration ? 'Celebration / Community' : 'Online / TBD'),
        description: trimmedDesc || (isCelebration ? 'Celebration / Anniversary Announcement' : ''),
        flyerUrl: flyerUrl.trim() || undefined,
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

          {/* Timing & Dates Section */}
          {isCelebration ? (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Schedule & Timing <span className="text-slate-400 font-normal">(Optional)</span>
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

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={date}
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {!isAllDayCelebration && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-700">
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

              {/* Multi-day Setting if span >= 2 */}
              {spanDays >= 2 && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <CalendarRange className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Multi-day Announcement ({spanDays} days)
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {spanDays >= 3 ? 'Multi-day Required' : 'Optional for 2 Days'}
                    </span>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={spanDays >= 3 ? true : isMultiDay}
                      disabled={spanDays >= 3}
                      onChange={(e) => {
                        if (spanDays === 2) setIsMultiDay(e.target.checked);
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Span multi-day across all {spanDays} days
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {spanDays >= 3
                          ? 'Required: Events spanning 3 or more calendar days are posted across every date.'
                          : isMultiDay
                          ? 'Checked: Will display across both days on the calendar.'
                          : 'Unchecked: Will be posted only to the first day.'}
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Date & Time Schedule
                </span>
                {spanDays > 1 && (
                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {spanDays} days total
                  </span>
                )}
              </div>

              {/* Start Date & Start Time Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
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
              </div>

              {/* End Date & End Time Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={date}
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
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

              {/* Overnight Midnight Helper for Same-Day Late Hours */}
              {date && endDate && date === endDate && startTime && endTime && startTime >= endTime && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Does this event run past midnight?</span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        For overnight events (e.g., {formatTime12h(startTime)} to {formatTime12h(endTime)}), End Date should be set to the next day. You can leave "Post as multi-day" unchecked below to post strictly to the first day without a multi-day icon.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDay = addDaysToDate(date, 1);
                      setEndDate(nextDay);
                      setIsMultiDay(false);
                      setError(null);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-950 dark:text-amber-100 bg-amber-200/90 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800 rounded-lg transition-colors border border-amber-300 dark:border-amber-700 shadow-2xs cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Set as Overnight Next Day</span>
                  </button>
                </div>
              )}

              {/* Multi-day Setting for Spans >= 2 */}
              {spanDays >= 2 && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <CalendarRange className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Multi-day Event Setting
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {spanDays >= 3 ? 'Required for 3+ Days' : 'Optional for 2 Days'}
                    </span>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={spanDays >= 3 ? true : isMultiDay}
                      disabled={spanDays >= 3}
                      onChange={(e) => {
                        if (spanDays === 2) {
                          setIsMultiDay(e.target.checked);
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Post as multi-day event spanning all {spanDays} days
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {spanDays >= 3
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

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
              Event Flyer / Image Link <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="url"
              value={flyerUrl}
              onChange={(e) => setFlyerUrl(e.target.value)}
              placeholder="https://example.com/event-flyer.jpg or public image URL"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Must be a direct image URL (ending in .jpg, .png, .webp, or hosted on Imgur/Postimages). This photo will be posted directly to Telegram when approved.
            </p>
            {flyerUrl.trim() && /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\//i.test(flyerUrl) && (
              <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1">
                <span className="font-bold">⚠️ Instagram post links cannot be used directly as flyer photos</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Meta's login wall prevents Telegram and external apps from downloading photos from post URLs.
                  <br />
                  <b>To use this flyer:</b> Open the Instagram post on a desktop computer, right-click the image, choose <b>"Copy Image Address"</b>, and paste that direct link here (or upload the flyer file to an image host like Postimages or Imgur).
                </p>
              </div>
            )}
            {flyerUrl.trim() && !/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\//i.test(flyerUrl) && (
              <div className="mt-2 flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <img
                  src={flyerUrl.trim()}
                  alt="Flyer preview"
                  className="w-12 h-12 object-cover rounded shadow-2xs border border-slate-200 dark:border-slate-700 shrink-0"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">Direct image attached</div>
                  <a
                    href={flyerUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 text-[11px] hover:underline truncate block"
                  >
                    {flyerUrl.trim()}
                  </a>
                </div>
              </div>
            )}
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
