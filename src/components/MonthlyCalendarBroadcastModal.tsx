import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Calendar,
  Image as ImageIcon,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  Users,
  Settings,
  Eye
} from 'lucide-react';
import { CalendarEvent, TelegramConfig } from '../types';
import { CATEGORIES } from '../constants';
import {
  captureCalendarElementAsBase64,
  downloadCalendarImageDirectly,
} from '../utils/calendarImageExport';
import {
  postMonthlyCalendarToTelegram,
  fetchTelegramSettings,
} from '../services/api';

interface MonthlyCalendarBroadcastModalProps {
  currentMonthDate: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onOpenSettings: () => void;
}

export const MonthlyCalendarBroadcastModal: React.FC<MonthlyCalendarBroadcastModalProps> = ({
  currentMonthDate,
  events,
  onClose,
  onOpenSettings,
}) => {
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(currentMonthDate);
  const [customNote, setCustomNote] = useState('');
  const [includeImage, setIncludeImage] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [resultStatus, setResultStatus] = useState<{
    success: boolean;
    message: string;
    targetChat?: string;
  } | null>(null);

  const year = selectedMonthDate.getFullYear();
  const month = selectedMonthDate.getMonth();
  const monthName = selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Filter events for this month
  const monthEvents = events
    .filter((e) => e.status === 'approved' && e.date.startsWith(monthPrefix))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

  // Category counts
  const categorySummary: Record<string, number> = {};
  monthEvents.forEach((e) => {
    categorySummary[e.category] = (categorySummary[e.category] || 0) + 1;
  });

  useEffect(() => {
    fetchTelegramSettings()
      .then((cfg) => setTelegramConfig(cfg))
      .catch((err) => console.error('Failed to load telegram settings:', err));
  }, []);

  // Generate Image Preview
  const handleGeneratePreview = async () => {
    setIsCapturing(true);
    setResultStatus(null);
    try {
      const base64 = await captureCalendarElementAsBase64(
        'calendar-grid-container',
        `SAKK Community Calendar — ${monthName}`
      );
      setPreviewImage(base64);
    } catch (err: any) {
      setResultStatus({
        success: false,
        message: `Failed to export calendar as image: ${err.message}`,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // Local Download
  const handleDownloadImage = async () => {
    setIsCapturing(true);
    try {
      await downloadCalendarImageDirectly(
        'calendar-grid-container',
        `SAKK_Calendar_${monthName.replace(/\s+/g, '_')}.png`,
        `SAKK Community Calendar — ${monthName}`
      );
      setResultStatus({
        success: true,
        message: 'Calendar exported as high-resolution PNG image and downloaded to your device.',
      });
    } catch (err: any) {
      setResultStatus({
        success: false,
        message: `Image export failed: ${err.message}`,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // Post to Telegram Events Chat
  const handlePostToEventsChat = async () => {
    setIsPosting(true);
    setResultStatus(null);
    try {
      let imageBase64ToSend: string | undefined = undefined;

      if (includeImage) {
        if (previewImage) {
          imageBase64ToSend = previewImage;
        } else {
          setIsCapturing(true);
          try {
            imageBase64ToSend = await captureCalendarElementAsBase64(
              'calendar-grid-container',
              `SAKK Community Calendar — ${monthName}`
            );
            setPreviewImage(imageBase64ToSend);
          } finally {
            setIsCapturing(false);
          }
        }
      }

      const res = await postMonthlyCalendarToTelegram({
        month,
        year,
        monthName,
        imageBase64: imageBase64ToSend,
        customNote: customNote.trim() || undefined,
        targetChatId: telegramConfig?.eventsChatId || telegramConfig?.channelChatId || telegramConfig?.adminChatId,
        targetTopicId: telegramConfig?.eventsTopicId,
      });

      if (res.success) {
        const topicLabel = res.postedToTopic ? ` (Topic #${res.postedToTopic})` : (telegramConfig?.eventsTopicId ? ` (Topic #${telegramConfig.eventsTopicId})` : '');
        setResultStatus({
          success: true,
          message: `Monthly calendar post successfully dispatched to Events Chat (${res.postedToChat || telegramConfig?.eventsChatId || 'configured'}${topicLabel})! ${res.hasPhoto ? 'Included calendar PNG snapshot.' : ''}`,
          targetChat: res.postedToChat,
        });
      } else {
        setResultStatus({
          success: false,
          message: res.error || 'Failed to dispatch monthly post to Telegram.',
        });
      }
    } catch (err: any) {
      setResultStatus({
        success: false,
        message: err.message || 'An error occurred while posting to Telegram.',
      });
    } finally {
      setIsPosting(false);
    }
  };

  const configuredEventsChat = telegramConfig?.eventsChatId || telegramConfig?.channelChatId || telegramConfig?.adminChatId;
  const configuredEventsTopic = telegramConfig?.eventsTopicId;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monthly-export-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50 dark:from-indigo-950/40 via-sky-50 dark:via-slate-900 to-white dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 id="monthly-export-title" className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Export & Post Monthly Calendar
              </h2>
              <p className="text-xs text-indigo-900 dark:text-indigo-300 font-medium">
                Export high-resolution calendar image & broadcast monthly summary to the events chat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {resultStatus && (
            <div
              className={`p-3.5 rounded-xl font-medium border flex items-start gap-2.5 ${
                resultStatus.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
              }`}
            >
              {resultStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span>{resultStatus.message}</span>
              </div>
            </div>
          )}

          {/* Month Selection & Overview Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Schedule Period</span>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{monthName}</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {monthEvents.length} Approved Events
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMonthDate(new Date(year, month - 1, 1))}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
              >
                &larr; Prev Month
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonthDate(new Date(2026, 8, 1))}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonthDate(new Date(year, month + 1, 1))}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
              >
                Next Month &rarr;
              </button>
            </div>
          </div>

          {/* Breakdown Pills */}
          {Object.keys(categorySummary).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Included categories:</span>
              {Object.entries(categorySummary).map(([cat, count]) => {
                const meta = CATEGORIES[cat] || CATEGORIES.other;
                return (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                    <span>{meta.label}: {count}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Section: Calendar Image Export & Preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-850 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Calendar Image Export (.PNG)</h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={handleGeneratePreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isCapturing ? 'Rendering...' : 'Render Image Preview'}</span>
                </button>

                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={handleDownloadImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Image (.PNG)</span>
                </button>
              </div>
            </div>

            {/* Image Preview Container */}
            {previewImage ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-950/5 dark:bg-slate-900/50 p-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 px-1">
                  <span>High-resolution capture ready for Telegram</span>
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Re-render
                  </button>
                </div>
                <img
                  src={previewImage}
                  alt={`Rendered calendar for ${monthName}`}
                  className="w-full max-h-56 object-contain rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs"
                />
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                <p className="font-medium text-xs text-slate-700 dark:text-slate-300">No image rendered yet.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Click <strong>Render Image Preview</strong> or broadcast directly to auto-capture the calendar grid.
                </p>
              </div>
            )}
          </div>

          {/* Section: Events Chat Broadcast Configuration */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Separate Events Chat Broadcast</h4>
              </div>

              {configuredEventsChat ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Target: {configuredEventsChat}{configuredEventsTopic ? ` (Topic #${configuredEventsTopic})` : ''}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" /> Configure Events Chat ID &rarr;
                </button>
              )}
            </div>

            {/* Custom Note Input */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Custom Announcement Note (Optional)
              </label>
              <textarea
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g., Welcome to our September schedule! Please join us for this month's major celebrations and workshops."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Options */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeImage}
                  onChange={(e) => setIncludeImage(e.target.checked)}
                  className="rounded text-indigo-600 h-4 w-4"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Attach high-resolution Calendar Grid Image to Telegram post
                </span>
              </label>

              {telegramConfig?.notifyMonthlyCalendar && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                  <span>
                    Monthly cron automation scheduled on day {telegramConfig.monthlyPostDay || 1} of every month
                  </span>
                </div>
              )}
            </div>

            {/* Broadcast CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isPosting || isCapturing || !configuredEventsChat}
                onClick={handlePostToEventsChat}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                {isPosting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatched Monthly Calendar to Events Chat...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      Broadcast {monthName} Calendar to Events Chat ({configuredEventsChat || 'Not Configured'}{configuredEventsTopic ? ` • Topic #${configuredEventsTopic}` : ''})
                    </span>
                  </>
                )}
              </button>
              {!configuredEventsChat && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 text-center mt-1.5 font-medium">
                  Please configure an Events Chat ID in Telegram Settings to dispatch broadcasts.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Telegram Routing Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
