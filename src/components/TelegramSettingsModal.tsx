import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Radio,
  ExternalLink,
  ShieldAlert,
  CalendarCheck,
  Calendar,
  Image as ImageIcon,
  Clock,
  Sparkles,
  Users,
  Hash,
  HelpCircle,
  Check,
  Repeat
} from 'lucide-react';
import {
  fetchTelegramSettings,
  saveTelegramSettings,
  testTelegramConnection,
  sendTelegramReminder
} from '../services/api';
import { TelegramConfig } from '../types';

interface TelegramSettingsModalProps {
  onClose: () => void;
  onSettingsSaved?: () => void;
  onOpenMonthlyBroadcastModal?: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  onClose,
  onSettingsSaved,
  onOpenMonthlyBroadcastModal,
}) => {
  const [botToken, setBotToken] = useState('');
  const [adminChatId, setAdminChatId] = useState('');
  const [adminTopicId, setAdminTopicId] = useState('');
  const [eventsChatId, setEventsChatId] = useState('');
  const [eventsTopicId, setEventsTopicId] = useState('');
  const [useSameChatForBoth, setUseSameChatForBoth] = useState(false);

  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true);
  const [notifyOnApproval, setNotifyOnApproval] = useState(true);
  const [notifyOnReschedule, setNotifyOnReschedule] = useState(true);
  const [notifyDailyReminders, setNotifyDailyReminders] = useState(true);
  const [notifyMonthlyCalendar, setNotifyMonthlyCalendar] = useState(true);
  const [monthlyPostDay, setMonthlyPostDay] = useState(1);
  const [includeCalendarImage, setIncludeCalendarImage] = useState(true);
  const [lastMonthlyPost, setLastMonthlyPost] = useState<TelegramConfig['lastMonthlyPost']>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAdmin, setTestingAdmin] = useState(false);
  const [testingEvents, setTestingEvents] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchTelegramSettings()
      .then((cfg) => {
        setAdminChatId(cfg.adminChatId || '');
        setAdminTopicId(cfg.adminTopicId || '');
        setEventsChatId(cfg.eventsChatId || cfg.channelChatId || '');
        setEventsTopicId(cfg.eventsTopicId || '');

        if (cfg.adminChatId && (!cfg.eventsChatId || cfg.eventsChatId === cfg.adminChatId)) {
          setUseSameChatForBoth(true);
        }

        setNotifyOnSubmission(cfg.notifyOnSubmission ?? true);
        setNotifyOnApproval(cfg.notifyOnApproval ?? true);
        setNotifyOnReschedule(cfg.notifyOnReschedule ?? true);
        setNotifyDailyReminders(cfg.notifyDailyReminders ?? true);
        setNotifyMonthlyCalendar(cfg.notifyMonthlyCalendar !== false);
        setMonthlyPostDay(cfg.monthlyPostDay || 1);
        setIncludeCalendarImage(cfg.includeCalendarImage !== false);
        setLastMonthlyPost(cfg.lastMonthlyPost);
      })
      .catch((err) => console.error('Failed to load telegram config:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      if (botToken.trim() && !/^\d+:[A-Za-z0-9_-]+$/.test(botToken.trim())) {
        setTestResult({
          success: false,
          message: 'Invalid Telegram Bot Token format. Tokens look like 1234567890:AAF... from @BotFather (not the bot username or name).',
        });
        setSaving(false);
        return;
      }

      const resolvedEventsChatId = useSameChatForBoth ? adminChatId.trim() : eventsChatId.trim();

      await saveTelegramSettings({
        botToken: botToken.trim() || undefined,
        adminChatId: adminChatId.trim(),
        adminTopicId: adminTopicId.trim(),
        eventsChatId: resolvedEventsChatId,
        eventsTopicId: eventsTopicId.trim(),
        channelChatId: resolvedEventsChatId,
        notifyOnSubmission,
        notifyOnApproval,
        notifyOnReschedule,
        notifyDailyReminders,
        notifyMonthlyCalendar,
        monthlyPostDay,
        includeCalendarImage,
      });
      setTestResult({
        success: true,
        message: 'Telegram settings and topic routing saved successfully!',
      });
      onSettingsSaved?.();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (targetType: 'admin' | 'events') => {
    if (targetType === 'admin') setTestingAdmin(true);
    else setTestingEvents(true);

    setTestResult(null);
    try {
      if (botToken.trim() && !/^\d+:[A-Za-z0-9_-]+$/.test(botToken.trim())) {
        setTestResult({
          success: false,
          message: 'Invalid Telegram Bot Token format. Tokens look like 1234567890:AAF... from @BotFather (not the bot username or name).',
        });
        if (targetType === 'admin') setTestingAdmin(false);
        else setTestingEvents(false);
        return;
      }

      const chatIdToTest = targetType === 'admin' ? adminChatId : (useSameChatForBoth ? adminChatId : eventsChatId);
      const topicIdToTest = targetType === 'admin' ? adminTopicId : eventsTopicId;

      const res = await testTelegramConnection(
        botToken.trim() || undefined,
        chatIdToTest || undefined,
        targetType,
        topicIdToTest || undefined
      );

      const topicLabel = topicIdToTest ? ` (Topic #${topicIdToTest})` : '';
      if (res.success) {
        setTestResult({
          success: true,
          message: `Test message delivered to ${targetType === 'admin' ? 'Admin Alerts' : 'Community Events'} topic${topicLabel} successfully! Check Telegram.`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || `Failed to send test message to ${targetType} chat/topic.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while testing Telegram connection.',
      });
    } finally {
      if (targetType === 'admin') setTestingAdmin(false);
      else setTestingEvents(false);
    }
  };

  const handleSendReminderBroadcast = async () => {
    setSendingReminder(true);
    setTestResult(null);
    try {
      const targetChat = useSameChatForBoth ? adminChatId : eventsChatId;
      const res = await sendTelegramReminder(undefined, targetChat || undefined, eventsTopicId || undefined);
      if (res.success) {
        const topicMsg = eventsTopicId ? ` (Topic #${eventsTopicId})` : '';
        setTestResult({
          success: true,
          message: `Upcoming event reminders dispatched to Events Chat/Topic${topicMsg}!`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to send reminders.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to broadcast reminders.',
      });
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="telegram-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-sky-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 id="telegram-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Telegram Routing & Topic Automation
              </h2>
              <p className="text-xs text-sky-900 font-medium">
                Route admin review alerts to one topic and community event updates/reminders to another topic
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close Telegram settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {testResult && (
            <div
              className={`p-3.5 rounded-xl font-medium border flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Bot Token Configuration */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-600" />
                Telegram Bot Credentials
              </h3>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 font-semibold hover:underline inline-flex items-center gap-1 text-[11px]"
              >
                Create Bot via @BotFather <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Leave blank to keep existing configured token"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                API Token generated by @BotFather (e.g., <code>123456789:ABCdef...</code>). Ensure your bot has administrator permissions in the group.
              </p>
            </div>
          </div>

          {/* Topic Finding Guide Banner */}
          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] text-sky-950">
              <p className="font-bold text-sky-900">How to get a Topic ID (Message Thread ID) in Telegram:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-sky-800">
                <li>Make sure <strong>Topics</strong> are enabled in your Telegram Supergroup settings.</li>
                <li>Right-click (or tap and hold on mobile) on the specific topic and click <strong>Copy Link</strong>.</li>
                <li>The Topic ID is the number at the end of the link: <code className="bg-sky-100 px-1 py-0.5 rounded font-mono text-[10px]">https://t.me/c/1234567890/<strong>42</strong></code> &rarr; Topic ID is <strong>42</strong>.</li>
                <li><strong>General Topic:</strong> For the main/general chat topic, leave the Topic ID <strong>blank</strong> (or enter 1; our server automatically normalizes it).</li>
              </ol>
            </div>
          </div>

          {/* Chat & Topic Routing: Admin Topic vs Events Topic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Admin Alerts Topic */}
            <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>1. Admin Alerts Topic</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                    Submissions
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 leading-relaxed">
                  Destination for incoming Google Form submissions, user requests, and administrator review notifications.
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                    Group / Chat ID
                  </label>
                  <input
                    type="text"
                    value={adminChatId}
                    onChange={(e) => setAdminChatId(e.target.value)}
                    placeholder="e.g., -1001987654321"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Supergroup ID (usually starts with <code>-100</code>)
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-amber-600" />
                      Admin Topic ID (Thread ID)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={adminTopicId}
                    onChange={(e) => setAdminTopicId(e.target.value)}
                    placeholder="e.g., 2 (or leave blank for General)"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Numeric ID of the Admin / Mod topic.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={testingAdmin || !adminChatId}
                onClick={() => handleTestConnection('admin')}
                className="w-full py-1.5 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md border border-amber-300 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{testingAdmin ? 'Pinging Admin Topic...' : 'Test Admin Topic'}</span>
              </button>
            </div>

            {/* 2. Events & Publications Topic */}
            <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>2. Events & Publications Topic</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                    Community
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                  Destination for approved event announcements, schedule changes, upcoming reminders, and calendar posts.
                </p>

                {/* Toggle: Same group chat or separate group */}
                <label className="flex items-center gap-2 select-none cursor-pointer bg-emerald-100/40 p-2 rounded-lg border border-emerald-200">
                  <input
                    type="checkbox"
                    checked={useSameChatForBoth}
                    onChange={(e) => setUseSameChatForBoth(e.target.checked)}
                    className="rounded text-emerald-600 h-3.5 w-3.5"
                  />
                  <span className="text-[11px] font-semibold text-emerald-950">
                    Use same group as Admin (different topic)
                  </span>
                </label>

                {!useSameChatForBoth && (
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                      Events Group / Channel ID
                    </label>
                    <input
                      type="text"
                      value={eventsChatId}
                      onChange={(e) => setEventsChatId(e.target.value)}
                      placeholder="e.g., -1001234567890 or @sakk_events"
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Separate group or channel for community events
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-emerald-600" />
                      Events Topic ID (Thread ID)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={eventsTopicId}
                    onChange={(e) => setEventsTopicId(e.target.value)}
                    placeholder="e.g., 5 (or leave blank for General)"
                    className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Numeric ID of the Events / Announcements topic.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={testingEvents || (!eventsChatId && !useSameChatForBoth && !adminChatId)}
                onClick={() => handleTestConnection('events')}
                className="w-full py-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-md border border-emerald-300 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{testingEvents ? 'Pinging Events Topic...' : 'Test Events Topic'}</span>
              </button>
            </div>
          </div>

          {/* Automated Notification Rules */}
          <div className="space-y-2.5 pt-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-sky-600" />
              Automation Rules & Topic Triggers
            </h3>

            <div className="space-y-2.5 border border-slate-200 rounded-xl p-3 bg-white">
              {/* Submission to Admin Topic */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyOnSubmission}
                  onChange={(e) => setNotifyOnSubmission(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      Alert Admin on New Google Form & User Submissions
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                      &rarr; Admin Topic
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Sends instant notification to your <strong>Admin Alerts Topic</strong> when someone submits an event.
                  </p>
                </div>
              </label>

              {/* Approval to Events Topic */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={notifyOnApproval}
                  onChange={(e) => setNotifyOnApproval(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Post Approved Event Announcements in Events Chat
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      &rarr; Events Topic
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    When an admin approves a submission, automatically dispatches full event details to your <strong>Events & Publications Topic</strong>.
                  </p>
                </div>
              </label>

              {/* Rescheduling Alerts to Events Topic */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={notifyOnReschedule}
                  onChange={(e) => setNotifyOnReschedule(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-emerald-600" />
                      Post Rescheduling & Important Time Changes
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      &rarr; Events Topic
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Alerts the community in your <strong>Events & Publications Topic</strong> when an event is rescheduled.
                  </p>
                </div>
              </label>

              {/* Daily Scheduled Event Reminders */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={notifyDailyReminders}
                  onChange={(e) => setNotifyDailyReminders(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5 text-emerald-600" />
                      Daily Morning Event Reminders
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      &rarr; Events Topic
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Dispatches a daily morning overview of today's approved schedule to the <strong>Events & Publications Topic</strong>.
                  </p>
                </div>
              </label>

              {/* Monthly Automated Calendar Post */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyMonthlyCalendar}
                    onChange={(e) => setNotifyMonthlyCalendar(e.target.checked)}
                    className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Monthly Automated Calendar Publication
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                        &rarr; Events Topic
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Automatically publishes a monthly calendar summary with breakdown to the <strong>Events & Publications Topic</strong>.
                    </p>
                  </div>
                </label>

                {notifyMonthlyCalendar && (
                  <div className="mt-2.5 ml-6.5 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-600" />
                        <span>Day of month to post:</span>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={monthlyPostDay}
                          onChange={(e) => setMonthlyPostDay(Math.max(1, Math.min(28, parseInt(e.target.value) || 1)))}
                          className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold text-xs"
                        />
                        <span className="text-slate-500 font-normal">(e.g. 1st of every month)</span>
                      </label>

                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCalendarImage}
                          onChange={(e) => setIncludeCalendarImage(e.target.checked)}
                          className="rounded text-indigo-600 h-3.5 w-3.5"
                        />
                        <ImageIcon className="w-3 h-3 text-indigo-600" />
                        <span>Include Calendar Image in post</span>
                      </label>
                    </div>

                    {onOpenMonthlyBroadcastModal && (
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Want to preview or broadcast right now?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMonthlyBroadcastModal();
                          }}
                          className="font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Open Monthly Image Broadcast &rarr;</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Last Monthly Post Info */}
          {lastMonthlyPost && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  <strong>Last Monthly Broadcast:</strong> {new Date(lastMonthlyPost.timestamp).toLocaleDateString()} at {new Date(lastMonthlyPost.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({lastMonthlyPost.hasImage ? 'Image attached' : 'Text overview'})
                  {lastMonthlyPost.topicId ? ` (Topic #${lastMonthlyPost.topicId})` : ''}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded font-semibold ${lastMonthlyPost.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {lastMonthlyPost.success ? 'Delivered' : 'Failed'}
              </span>
            </div>
          )}

          {/* Quick Triggers */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={sendingReminder || (!adminChatId && !eventsChatId)}
              onClick={handleSendReminderBroadcast}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-3 h-3 text-emerald-600" />
              <span>{sendingReminder ? 'Broadcasting...' : "Broadcast Today's Reminders to Events Topic Now"}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Telegram Topic Routing'}
          </button>
        </div>
      </div>
    </div>
  );
};
