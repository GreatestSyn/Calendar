import React, { useState, useEffect, useMemo } from 'react';
import { RecurrenceRule, RecurrenceFrequency, WeekOfMonth, DayOfWeek } from '../types';
import {
  WEEKDAYS,
  WEEKS_OF_MONTH,
  parseDateLocal,
  getWeekOfMonthForDate,
  calculateRecurringDates,
  formatRecurrenceLabel,
  getDayOrdinal,
} from '../utils/recurrence';
import { Repeat, Calendar, Check, SlidersHorizontal, Info, Sparkles } from 'lucide-react';

interface RecurrenceSelectorProps {
  baseDate: string; // YYYY-MM-DD
  rule: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
}

export const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({
  baseDate,
  rule,
  onChange,
}) => {
  const [isEnabled, setIsEnabled] = useState(Boolean(rule && rule.frequency !== 'none'));
  const [activePreset, setActivePreset] = useState<string>('custom');

  // Parse details from baseDate
  const baseDateObj = useMemo(() => {
    try {
      return parseDateLocal(baseDate);
    } catch {
      return new Date();
    }
  }, [baseDate]);

  const baseDayOfWeek = baseDateObj.getDay() as DayOfWeek;
  const baseDayOfMonth = baseDateObj.getDate();
  const { weekOfMonth: detectedWeekOfMonth } = useMemo(
    () => getWeekOfMonthForDate(baseDateObj),
    [baseDateObj]
  );

  // Local state for rule configuration
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency || 'monthly_weekday');
  const [interval, setInterval] = useState<number>(rule?.interval || 1);
  const [weekOfMonth, setWeekOfMonth] = useState<WeekOfMonth>(rule?.weekOfMonth ?? detectedWeekOfMonth);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(rule?.dayOfWeek ?? baseDayOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState<number>(rule?.dayOfMonth ?? baseDayOfMonth);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(rule?.daysOfWeek ?? [baseDayOfWeek]);
  const [endType, setEndType] = useState<'occurrences' | 'until_date'>(rule?.endType || 'occurrences');
  const [occurrences, setOccurrences] = useState<number>(rule?.occurrences || 4);
  const [untilDate, setUntilDate] = useState<string>(() => {
    if (rule?.untilDate) return rule.untilDate;
    const future = new Date(baseDateObj);
    future.setMonth(future.getMonth() + 4);
    return future.toISOString().split('T')[0];
  });

  // Construct current rule object
  const currentRule: RecurrenceRule = useMemo(() => {
    const built: RecurrenceRule = {
      frequency,
      interval: Math.max(1, interval),
      endType,
      occurrences: endType === 'occurrences' ? occurrences : undefined,
      untilDate: endType === 'until_date' ? untilDate : undefined,
    };

    if (frequency === 'monthly_weekday') {
      built.weekOfMonth = weekOfMonth;
      built.dayOfWeek = dayOfWeek;
    } else if (frequency === 'monthly_date') {
      built.dayOfMonth = dayOfMonth;
    } else if (frequency === 'weekly') {
      built.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [baseDayOfWeek];
    } else if (frequency === 'custom') {
      built.weekOfMonth = weekOfMonth;
      built.dayOfWeek = dayOfWeek;
      built.daysOfWeek = daysOfWeek;
    }

    built.humanReadable = formatRecurrenceLabel(built);
    return built;
  }, [frequency, interval, endType, occurrences, untilDate, weekOfMonth, dayOfWeek, dayOfMonth, daysOfWeek, baseDayOfWeek]);

  // Compute preview dates
  const previewDates = useMemo(() => {
    if (!isEnabled) return [];
    try {
      return calculateRecurringDates(baseDate, currentRule);
    } catch {
      return [];
    }
  }, [isEnabled, baseDate, currentRule]);

  // Handle Enable/Disable
  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      onChange(currentRule);
    } else {
      onChange(null);
    }
  };

  // Sync back to parent whenever rule changes and enabled
  useEffect(() => {
    if (isEnabled) {
      onChange(currentRule);
    }
  }, [currentRule, isEnabled]);

  // Update defaults when baseDate changes
  useEffect(() => {
    setDayOfMonth(baseDayOfMonth);
    setDayOfWeek(baseDayOfWeek);
    setWeekOfMonth(detectedWeekOfMonth);
    if (!daysOfWeek.includes(baseDayOfWeek)) {
      setDaysOfWeek([baseDayOfWeek]);
    }
  }, [baseDayOfMonth, baseDayOfWeek, detectedWeekOfMonth]);

  // Presets Handlers
  const applyPreset1stFriday = () => {
    setActivePreset('1st_friday');
    setFrequency('monthly_weekday');
    setWeekOfMonth(1);
    setDayOfWeek(5); // Friday
    setInterval(1);
    setEndType('occurrences');
    setOccurrences(4);
  };

  const applyPreset3rdSunday = () => {
    setActivePreset('3rd_sunday');
    setFrequency('monthly_weekday');
    setWeekOfMonth(3);
    setDayOfWeek(0); // Sunday
    setInterval(1);
    setEndType('occurrences');
    setOccurrences(4);
  };

  const applyPresetSameDayMonthly = () => {
    setActivePreset('same_day');
    setFrequency('monthly_date');
    setDayOfMonth(baseDayOfMonth);
    setInterval(1);
    setEndType('occurrences');
    setOccurrences(4);
  };

  const applyPresetWeekly = () => {
    setActivePreset('weekly');
    setFrequency('weekly');
    setDaysOfWeek([baseDayOfWeek]);
    setInterval(1);
    setEndType('occurrences');
    setOccurrences(6);
  };

  const applyCustomMode = () => {
    setActivePreset('custom');
  };

  const toggleDayOfWeek = (dow: DayOfWeek) => {
    if (daysOfWeek.includes(dow)) {
      if (daysOfWeek.length > 1) {
        setDaysOfWeek(daysOfWeek.filter((d) => d !== dow));
      }
    } else {
      setDaysOfWeek([...daysOfWeek, dow]);
    }
  };

  const formatPreviewDate = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-3">
      {/* Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
          }`}>
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs text-slate-900 block">Repeat / Recurring Schedule</span>
            <span className="text-[11px] text-slate-500 block">Schedule monthly, weekly, or custom recurring dates</span>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => handleToggle(!isEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="pt-2 border-t border-slate-200 space-y-3 animate-in fade-in-50 duration-150">
          {/* Preset Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Quick Recurring Patterns:
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={applyPreset1stFriday}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                  activePreset === '1st_friday'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Every 1st Friday
              </button>

              <button
                type="button"
                onClick={applyPreset3rdSunday}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                  activePreset === '3rd_sunday'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Every 3rd Sunday
              </button>

              <button
                type="button"
                onClick={applyPresetSameDayMonthly}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                  activePreset === 'same_day'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Same Day Monthly ({baseDayOfMonth}{getDayOrdinal(baseDayOfMonth)})
              </button>

              <button
                type="button"
                onClick={applyPresetWeekly}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                  activePreset === 'weekly'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Weekly
              </button>

              <button
                type="button"
                onClick={applyCustomMode}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1 ${
                  activePreset === 'custom'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Custom Selection...
              </button>
            </div>
          </div>

          {/* Detailed Config Options */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3 text-xs">
            {/* Frequency dropdown & interval */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Recurrence Type
                </label>
                <select
                  value={frequency}
                  onChange={(e) => {
                    setFrequency(e.target.value as RecurrenceFrequency);
                    setActivePreset('custom');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  <option value="monthly_weekday">Monthly by day of week (e.g. 1st Fri, 3rd Sun)</option>
                  <option value="monthly_date">Monthly on specific date (e.g. 15th of month)</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom Selection</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Repeat Interval
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px]">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={interval}
                    onChange={(e) => {
                      setInterval(Math.max(1, parseInt(e.target.value) || 1));
                      setActivePreset('custom');
                    }}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center font-bold"
                  />
                  <span className="text-slate-600 text-[11px]">
                    {frequency === 'daily'
                      ? (interval === 1 ? 'day' : 'days')
                      : frequency === 'weekly'
                      ? (interval === 1 ? 'week' : 'weeks')
                      : frequency === 'yearly'
                      ? (interval === 1 ? 'year' : 'years')
                      : (interval === 1 ? 'month' : 'months')}
                  </span>
                </div>
              </div>
            </div>

            {/* When monthly_weekday */}
            {(frequency === 'monthly_weekday' || (frequency === 'custom' && weekOfMonth !== undefined)) && (
              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-700">On the</span>
                <select
                  value={weekOfMonth}
                  onChange={(e) => {
                    setWeekOfMonth(parseInt(e.target.value) as WeekOfMonth);
                    setActivePreset('custom');
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {WEEKS_OF_MONTH.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>

                <select
                  value={dayOfWeek}
                  onChange={(e) => {
                    setDayOfWeek(parseInt(e.target.value) as DayOfWeek);
                    setActivePreset('custom');
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-600">of each cycle</span>
              </div>
            )}

            {/* When monthly_date */}
            {frequency === 'monthly_date' && (
              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-700">On the</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => {
                    setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)));
                    setActivePreset('custom');
                  }}
                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                />
                <span className="text-[11px] text-slate-700 font-medium">
                  {getDayOrdinal(dayOfMonth)} of each month
                </span>
              </div>
            )}

            {/* When weekly */}
            {frequency === 'weekly' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Repeat on Days:
                </label>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((d) => {
                    const selected = daysOfWeek.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => {
                          toggleDayOfWeek(d.value);
                          setActivePreset('custom');
                        }}
                        className={`w-9 h-8 rounded-md text-xs font-semibold transition-all border ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recurrence End Condition */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Ends
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === 'occurrences'}
                    onChange={() => setEndType('occurrences')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px]">After</span>
                  <input
                    type="number"
                    min={2}
                    max={36}
                    value={occurrences}
                    disabled={endType !== 'occurrences'}
                    onChange={(e) => setOccurrences(Math.max(2, parseInt(e.target.value) || 4))}
                    className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 text-center font-bold disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-[11px]">occurrences</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="endType"
                    checked={endType === 'until_date'}
                    onChange={() => setEndType('until_date')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px]">On date</span>
                  <input
                    type="date"
                    value={untilDate}
                    disabled={endType !== 'until_date'}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Live Schedule Summary & Dates Preview */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 space-y-2">
            <div className="flex items-start gap-2">
              <Repeat className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-xs text-emerald-900">
                  {currentRule.humanReadable}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Will generate <strong>{previewDates.length} calendar events</strong> automatically upon submission.
                </p>
              </div>
            </div>

            {previewDates.length > 0 && (
              <div className="pt-1.5 border-t border-emerald-200/80">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block mb-1">
                  Scheduled Dates Preview:
                </span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {previewDates.map((dt, idx) => (
                    <span
                      key={dt}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-white text-emerald-900 border border-emerald-300 rounded shadow-2xs"
                    >
                      <span className="text-[9px] text-emerald-600 font-bold">#{idx + 1}</span>
                      {formatPreviewDate(dt)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
