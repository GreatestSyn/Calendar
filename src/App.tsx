import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarEvent, EventCategory, AdminNotification, RealtimeMessage } from './types';
import { INITIAL_EVENTS, CATEGORIES, formatTime12h, formatDatePretty } from './constants';
import {
  fetchEvents,
  subscribeToRealtimeEvents,
  approveEvent,
  rejectEvent,
  updateEvent,
  deleteEvent,
  fetchTelegramSettings,
  sendTelegramReminder
} from './services/api';
import { CalendarHeader } from './components/CalendarHeader';
import { SearchBar, TimeframeFilter } from './components/SearchBar';
import { CalendarGrid } from './components/CalendarGrid';
import { MonthEventsSidebar } from './components/MonthEventsSidebar';
import { DayItineraryDrawer } from './components/DayItineraryDrawer';
import { EventDetailsModal } from './components/EventDetailsModal';
import { AdminApprovalQueueModal } from './components/AdminApprovalQueueModal';
import { GoogleFormSetupModal } from './components/GoogleFormSetupModal';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { MonthlyCalendarBroadcastModal } from './components/MonthlyCalendarBroadcastModal';
import { RescheduleModal } from './components/RescheduleModal';
import { SubmitEventModal } from './components/SubmitEventModal';
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Hourglass,
  ShieldAlert,
  Sparkles,
  Download,
  CalendarPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { downloadIcsFile } from './utils/calendarExport';

export default function App() {
  return (
    <AuthProvider>
      <CalendarAppContent />
    </AuthProvider>
  );
}

function CalendarAppContent() {
  const {
    user,
    isAdmin,
    isViewingAsUser,
    effectiveIsAdmin,
    toggleViewAsUser,
  } = useAuth();

  // Calendar month state (defaults to September 2026 to match current context)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date(2026, 8, 1));
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isTelegramConfigured, setIsTelegramConfigured] = useState(false);

  // Active selections
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleTargetEvent, setRescheduleTargetEvent] = useState<CalendarEvent | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('this_month');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);
  const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isMonthlyBroadcastOpen, setIsMonthlyBroadcastOpen] = useState(false);
  const [isEventModalEditMode, setIsEventModalEditMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initial fetch and Telegram status check (refetches whenever user changes)
  useEffect(() => {
    fetchEvents()
      .then((data) => {
        if (data.events) {
          setEvents(data.events);
        }
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch((err) => {
        console.warn('Backend events fetch fallback to local seed:', err);
      });

    fetchTelegramSettings()
      .then((cfg) => setIsTelegramConfigured(cfg.isConfigured))
      .catch(() => {});
  }, [user]);

  // Subscribe to real-time Server-Sent Events (SSE)
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeEvents(
      (msg: RealtimeMessage) => {
        if (msg.type === 'INIT') {
          if (msg.events) setEvents(msg.events);
          if (msg.message) console.log('SSE Init:', msg.message);
        } else if (msg.type === 'EVENT_SUBMITTED') {
          const incomingEvents = msg.events && msg.events.length > 0
            ? msg.events
            : (msg.event ? [msg.event] : []);
          if (incomingEvents.length > 0) {
            setEvents((prev) => {
              const prevIds = new Set(prev.map((e) => e.id));
              const newItems = incomingEvents.filter((e) => !prevIds.has(e.id));
              return newItems.length > 0 ? [...newItems, ...prev] : prev;
            });
          }
          if (msg.event) {
            setNotifications((prev) => [
              {
                id: `notif-${Date.now()}`,
                title: 'New Event Submission',
                message: `${msg.event.submitterName} submitted "${msg.event.title}" awaiting approval.`,
                type: 'submission',
                eventId: msg.event.id,
                timestamp: msg.timestamp,
                read: false,
              },
              ...prev,
            ]);
          }
        } else if (msg.type === 'EVENT_APPROVED' && msg.event) {
          const approvedSeriesId = msg.event.recurringSeriesId;
          const seriesEvents = msg.events && msg.events.length > 0 ? msg.events : [msg.event];
          const approvedMap = new Map(seriesEvents.map((e) => [e.id, e]));

          setEvents((prev) =>
            prev.map((e) => {
              if (approvedMap.has(e.id)) return approvedMap.get(e.id)!;
              if (approvedSeriesId && e.recurringSeriesId === approvedSeriesId) {
                return {
                  ...e,
                  status: 'approved',
                  approvedAt: msg.event!.approvedAt || new Date().toISOString(),
                  approvedBy: msg.event!.approvedBy || 'Administrator',
                };
              }
              return e;
            })
          );
          setNotifications((prev) => [
            {
              id: `notif-${Date.now()}`,
              title: 'Event Approved & Scheduled',
              message: `"${msg.event.title}" has been published to the calendar.`,
              type: 'approval',
              eventId: msg.event.id,
              timestamp: msg.timestamp,
              read: false,
            },
            ...prev,
          ]);
        } else if (msg.type === 'EVENT_REJECTED' && msg.event) {
          const rejectedSeriesId = msg.event.recurringSeriesId;
          const seriesEvents = msg.events && msg.events.length > 0 ? msg.events : [msg.event];
          const rejectedMap = new Map(seriesEvents.map((e) => [e.id, e]));

          setEvents((prev) =>
            prev.map((e) => {
              if (rejectedMap.has(e.id)) return rejectedMap.get(e.id)!;
              if (rejectedSeriesId && e.recurringSeriesId === rejectedSeriesId) {
                return {
                  ...e,
                  status: 'rejected',
                  rejectionReason: msg.event!.rejectionReason || 'Declined by administrator',
                };
              }
              return e;
            })
          );
        } else if (msg.type === 'EVENT_UPDATED' && msg.event) {
          const updatedEvents = msg.seriesEvents && msg.seriesEvents.length > 0
            ? msg.seriesEvents
            : [msg.event];
          const updatedMap = new Map(updatedEvents.map((e) => [e.id, e]));

          setEvents((prev) =>
            prev.map((e) => updatedMap.get(e.id) || e)
          );
        } else if (msg.type === 'EVENT_DELETED' && msg.eventId) {
          if (msg.seriesId) {
            setEvents((prev) => prev.filter((e) => e.recurringSeriesId !== msg.seriesId));
          } else {
            setEvents((prev) => prev.filter((e) => e.id !== msg.eventId));
          }
          if (msg.notification) {
            setNotifications((prev) => [msg.notification, ...prev]);
          }
        } else if (msg.type === 'TELEGRAM_CONFIG_UPDATED') {
          fetchTelegramSettings()
            .then((cfg) => setIsTelegramConfigured(cfg.isConfigured))
            .catch(() => {});
        }
      },
      (status) => setConnectionStatus(status)
    );

    return () => unsubscribe();
  }, []);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleToday = () => {
    setCurrentMonthDate(new Date(2026, 8, 1));
    setSelectedDate('2026-09-13');
  };

  // Approval actions
  const handleApproveEvent = async (id: string, updates?: Partial<CalendarEvent>) => {
    try {
      const res = await approveEvent(id, 'Administrator', updates);
      const seriesId = res.event?.recurringSeriesId;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === id) return res.event;
          if (seriesId && e.recurringSeriesId === seriesId) {
            return {
              ...e,
              status: 'approved',
              approvedAt: res.event.approvedAt || new Date().toISOString(),
              approvedBy: res.event.approvedBy || 'Administrator',
            };
          }
          return e;
        })
      );
      if (selectedEvent?.id === id) {
        setSelectedEvent(res.event);
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectEvent = async (id: string, reason?: string) => {
    try {
      const res = await rejectEvent(id, reason);
      const seriesId = res.event?.recurringSeriesId;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === id) return res.event;
          if (seriesId && e.recurringSeriesId === seriesId) {
            return {
              ...e,
              status: 'rejected',
              rejectionReason: reason || 'Declined by administrator',
            };
          }
          return e;
        })
      );
      if (selectedEvent?.id === id) {
        setSelectedEvent(res.event);
      }
    } catch (err: any) {
      alert(`Decline error: ${err.message}`);
    }
  };

  const handleUpdateEvent = async (id: string, patch: Partial<CalendarEvent>, scope: 'single' | 'series' = 'single') => {
    try {
      const res = await updateEvent(id, patch, { scope });
      const targetEvent = events.find((e) => e.id === id);
      if (scope === 'series' && targetEvent?.recurringSeriesId) {
        setEvents((prev) =>
          prev.map((e) => {
            if (e.recurringSeriesId === targetEvent.recurringSeriesId) {
              return {
                ...e,
                ...patch,
                date: e.date, // keep individual recurring occurrence dates
              };
            }
            return e;
          })
        );
      } else {
        setEvents((prev) => prev.map((e) => (e.id === id ? res.event : e)));
      }
      if (selectedEvent?.id === id) {
        setSelectedEvent(res.event);
      }
    } catch (err: any) {
      alert(`Update error: ${err.message}`);
    }
  };

  const handleDeleteEvent = async (id: string, scope: 'single' | 'series' = 'single') => {
    try {
      const targetEvent = events.find((e) => e.id === id);
      const res = await deleteEvent(id, { scope });
      const seriesId = res?.seriesId || targetEvent?.recurringSeriesId;
      if (scope === 'series' && seriesId) {
        setEvents((prev) => prev.filter((e) => e.recurringSeriesId !== seriesId));
      } else {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
      if (
        selectedEvent?.id === id ||
        (scope === 'series' && seriesId && selectedEvent?.recurringSeriesId === seriesId)
      ) {
        setSelectedEvent(null);
      }
    } catch (err: any) {
      console.error('Delete event error:', err);
      throw err;
    }
  };

  const handleSendTelegramAlert = async (event: CalendarEvent) => {
    const res = await sendTelegramReminder(event.id);
    if (!res.success) {
      throw new Error(res.error || 'Failed to dispatch Telegram reminder');
    }
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setTimeframe('this_month');
    setStatusFilter('all');
  };

  // Pending count for administrator badge and queue (deduplicated by ID)
  const pendingEvents = useMemo(() => {
    if (!effectiveIsAdmin) return [];
    const seen = new Set<string>();
    return events.filter((e) => {
      if (e.status !== 'pending') return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [events, effectiveIsAdmin]);

  // Filtered events calculation
  const filteredEvents = useMemo(() => {
    const todayStr = '2026-09-13';
    const curYear = currentMonthDate.getFullYear();
    const curMonth = currentMonthDate.getMonth() + 1;
    const curMonthPrefix = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    return events.filter((evt) => {
      // Role visibility check: Non-admins or admins in visitor preview mode only see approved events
      if (!effectiveIsAdmin && evt.status !== 'approved') {
        return false;
      }

      // 1. Text Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(query);
        const matchesDesc = evt.description?.toLowerCase().includes(query);
        const matchesLoc = evt.location?.toLowerCase().includes(query);
        const matchesSubmitter = evt.submitterName?.toLowerCase().includes(query) || evt.submitterEmail?.toLowerCase().includes(query);
        const matchesDate = evt.date.includes(query) || (evt.endDate ? evt.endDate.includes(query) : false);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesSubmitter && !matchesDate) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory !== 'all' && evt.category !== selectedCategory) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'all' && evt.status !== statusFilter) {
        return false;
      }

      // 4. Timeframe Filter (accounts for multi-day spans)
      if (timeframe === 'this_month') {
        const lastDayOfMonth = new Date(curYear, curMonth, 0).getDate();
        const monthStartStr = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
        const monthEndStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
        const inMonth =
          (evt.date >= monthStartStr && evt.date <= monthEndStr) ||
          (evt.endDate && evt.date <= monthEndStr && evt.endDate >= monthStartStr);
        if (!inMonth) return false;
      } else if (timeframe === 'upcoming') {
        const isUpcoming = evt.date >= todayStr || (evt.endDate && evt.endDate >= todayStr);
        if (!isUpcoming) return false;
      } else if (timeframe === 'past') {
        const effectiveEnd = evt.endDate || evt.date;
        if (effectiveEnd >= todayStr) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedCategory, statusFilter, timeframe, currentMonthDate, effectiveIsAdmin]);

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col text-slate-900 font-sans">
      {/* Top Navigation & Header */}
      <CalendarHeader
        currentMonthDate={currentMonthDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        pendingCount={pendingEvents.length}
        connectionStatus={connectionStatus}
        isTelegramConfigured={isTelegramConfigured}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        onOpenGoogleFormModal={() => setIsGoogleFormModalOpen(true)}
        onOpenApprovalQueue={() => setIsApprovalQueueOpen(true)}
        onOpenTelegramSettings={() => setIsTelegramModalOpen(true)}
        onOpenMonthlyBroadcast={() => setIsMonthlyBroadcastOpen(true)}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        currentUser={user}
        effectiveIsAdmin={effectiveIsAdmin}
        isRealAdmin={isAdmin}
        isViewingAsUser={isViewingAsUser}
        onToggleViewAsUser={toggleViewAsUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Visitor Preview Banner for Admins */}
      {isAdmin && isViewingAsUser && (
        <aside
          aria-label="Visitor preview mode alert"
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 px-4 py-2 border-b border-amber-600/40 flex items-center justify-between shadow-2xs text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-amber-950 shrink-0" aria-hidden="true" />
            <span>
              <strong>Visitor Preview Active:</strong> You are viewing the calendar as a public visitor. Administrative controls and pending submissions are hidden.
            </span>
          </div>
          <button
            onClick={toggleViewAsUser}
            className="px-3 py-1 bg-amber-950 text-white hover:bg-black rounded-lg transition-colors font-bold text-xs shrink-0 ml-3 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-900"
          >
            Return to Admin View
          </button>
        </aside>
      )}

      {/* Prominent Search and Filter Bar */}
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        totalResults={filteredEvents.length}
        onResetFilters={handleResetFilters}
      />

      {/* Admin Approval Alert Banner (if pending submissions exist and admin mode active) */}
      {pendingEvents.length > 0 && effectiveIsAdmin && (
        <section
          aria-label="Pending administrator approval alert"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2 sm:px-6"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                <strong>Administrator Alert:</strong> {pendingEvents.length} new {pendingEvents.length === 1 ? 'event submission is' : 'event submissions are'} awaiting approval.
              </span>
            </div>
            <button
              onClick={() => setIsApprovalQueueOpen(true)}
              className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline self-start sm:self-auto"
            >
              <span>Review Approval Queue ({pendingEvents.length}) &rarr;</span>
            </button>
          </div>
        </section>
      )}

      {/* Main Calendar Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6" id="main-calendar-content">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Main Calendar Month Grid (3 cols on desktop) */}
            <div className="lg:col-span-3">
              <CalendarGrid
                currentMonthDate={currentMonthDate}
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={(dateStr) => setSelectedDate(dateStr)}
                onSelectEvent={(evt) => setSelectedEvent(evt)}
              />

              {/* Instructions badge below calendar */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Tip: Click any date cell to open its day itinerary; click an event title to view full Google Form details.</span>
                <span className="hidden sm:inline font-medium text-indigo-600">Real-time SSE active</span>
              </div>
            </div>

            {/* Month Events Sidebar (1 col on desktop) */}
            <div className="lg:col-span-1 h-full min-h-[500px]">
              <MonthEventsSidebar
                currentMonthDate={currentMonthDate}
                events={filteredEvents}
                onSelectEvent={(evt) => setSelectedEvent(evt)}
                onSelectDate={(dateStr) => setSelectedDate(dateStr)}
              />
            </div>
          </div>
        ) : (
          /* Month List View */
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Complete Event Directory
                </h2>
                <p className="text-xs text-slate-500">
                  {filteredEvents.length} events matching current filters
                </p>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No events found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Try adjusting your search criteria or submit a new event.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100" role="list">
                {filteredEvents.map((evt) => {
                  const meta = CATEGORIES[evt.category] || CATEGORIES.other;
                  const isPending = evt.status === 'pending';

                  return (
                    <article
                      key={evt.id}
                      role="listitem"
                      onClick={() => setSelectedEvent(evt)}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            {meta.label}
                          </span>
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              <Hourglass className="w-2.5 h-2.5" /> Pending Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                          {evt.title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-1 max-w-2xl">
                          {evt.description}
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end text-xs text-slate-500 shrink-0 gap-1.5">
                        <span className="font-semibold text-slate-800">
                          {formatDatePretty(evt.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {evt.startTime
                            ? `${formatTime12h(evt.startTime)}${evt.endTime ? ` - ${formatTime12h(evt.endTime)}` : ''}`
                            : (evt.category === 'celebration' ? 'All Day Celebration' : 'Untimed')}
                        </span>
                        {evt.location && (
                          <span className="inline-flex items-center gap-1 text-[11px] truncate max-w-xs">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {evt.location}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadIcsFile(evt);
                          }}
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/60 shadow-2xs transition-colors self-start sm:self-end"
                          title="Download this event to your personal calendar (.ics)"
                        >
                          <Download className="w-3 h-3" />
                          <span>Add to Calendar</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Day Itinerary Drawer (Triggered by clicking a calendar date) */}
      <DayItineraryDrawer
        selectedDate={selectedDate}
        events={events}
        onClose={() => setSelectedDate(null)}
        onSelectEvent={(evt) => setSelectedEvent(evt)}
        onAddEventForDate={(dateStr) => {
          setSelectedDate(null);
          setIsSubmitModalOpen(true);
        }}
      />

      {/* Full Event Details Modal (Triggered by clicking any event title) */}
      <EventDetailsModal
        event={selectedEvent}
        initialEditMode={isEventModalEditMode && effectiveIsAdmin}
        isAdmin={effectiveIsAdmin}
        onClose={() => {
          setSelectedEvent(null);
          setIsEventModalEditMode(false);
        }}
        onApprove={handleApproveEvent}
        onReject={handleRejectEvent}
        onUpdate={handleUpdateEvent}
        onOpenReschedule={(evt) => {
          setSelectedEvent(null);
          setIsEventModalEditMode(false);
          setRescheduleTargetEvent(evt);
        }}
        onSendTelegramAlert={handleSendTelegramAlert}
        onDelete={handleDeleteEvent}
        isTelegramConfigured={isTelegramConfigured}
      />

      {/* Admin Approval Queue Modal */}
      {isApprovalQueueOpen && effectiveIsAdmin && (
        <AdminApprovalQueueModal
          pendingEvents={pendingEvents}
          onClose={() => setIsApprovalQueueOpen(false)}
          onApprove={handleApproveEvent}
          onReject={handleRejectEvent}
          onDelete={handleDeleteEvent}
          onSelectEvent={(evt) => {
            setIsApprovalQueueOpen(false);
            setIsEventModalEditMode(false);
            setSelectedEvent(evt);
          }}
          onEditEvent={(evt) => {
            setIsApprovalQueueOpen(false);
            setIsEventModalEditMode(true);
            setSelectedEvent(evt);
          }}
        />
      )}

      {/* Google Form Setup & Webhook Simulator Modal */}
      {isGoogleFormModalOpen && effectiveIsAdmin && (
        <GoogleFormSetupModal
          onClose={() => setIsGoogleFormModalOpen(false)}
          onEventSubmitted={() => {
            // refresh
          }}
        />
      )}

      {/* Telegram Notifications Settings Modal */}
      {isTelegramModalOpen && effectiveIsAdmin && (
        <TelegramSettingsModal
          onClose={() => setIsTelegramModalOpen(false)}
          onSettingsSaved={() => {
            fetchTelegramSettings().then((cfg) => setIsTelegramConfigured(cfg.isConfigured));
          }}
          onOpenMonthlyBroadcastModal={() => {
            setIsTelegramModalOpen(false);
            setIsMonthlyBroadcastOpen(true);
          }}
        />
      )}

      {/* Monthly Calendar Export & Broadcast Modal */}
      {isMonthlyBroadcastOpen && effectiveIsAdmin && (
        <MonthlyCalendarBroadcastModal
          currentMonthDate={currentMonthDate}
          events={events}
          onClose={() => setIsMonthlyBroadcastOpen(false)}
          onOpenSettings={() => setIsTelegramModalOpen(true)}
        />
      )}

      {/* Reschedule Event Modal */}
      {rescheduleTargetEvent && effectiveIsAdmin && (
        <RescheduleModal
          event={rescheduleTargetEvent}
          onClose={() => setRescheduleTargetEvent(null)}
          onSave={handleUpdateEvent}
          isTelegramConfigured={isTelegramConfigured}
        />
      )}

      {/* Submit Event Modal (Accessible to anyone) */}
      {isSubmitModalOpen && (
        <SubmitEventModal
          initialDate={selectedDate}
          onClose={() => setIsSubmitModalOpen(false)}
          onEventCreated={(evt, series) => {
            const incoming = series && series.length > 0 ? series : (evt ? [evt] : []);
            setEvents((prev) => {
              const prevIds = new Set(prev.map((e) => e.id));
              const toAdd = incoming.filter((e) => !prevIds.has(e.id));
              return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
            });
          }}
        />
      )}

      {/* Floating Live Real-Time Notifications Toast (Admin only) */}
      {effectiveIsAdmin && (
        <LiveNotificationToast
          notifications={notifications}
          onDismiss={handleDismissNotification}
          onOpenApprovalQueue={() => setIsApprovalQueueOpen(true)}
          onSelectEventById={(id) => {
            const found = events.find((e) => e.id === id);
            if (found) setSelectedEvent(found);
          }}
        />
      )}

      {/* Google OAuth & Permissions Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
