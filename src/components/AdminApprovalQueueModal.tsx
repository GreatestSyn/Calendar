import React, { useEffect, useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { CATEGORIES, formatTime12h, formatDatePretty, calculateDaysBetween, formatEventDateRange } from '../constants';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MapPin,
  FileSpreadsheet,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Calendar,
  Repeat,
  CalendarRange,
} from 'lucide-react';

interface AdminApprovalQueueModalProps {
  pendingEvents: CalendarEvent[];
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onDelete?: (id: string, scope?: 'single' | 'series') => Promise<void>;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

interface ApprovalQueueItem {
  type: 'single' | 'series';
  id: string; // Lead event ID for actions
  leadEvent: CalendarEvent;
  occurrences: CalendarEvent[];
}

export const AdminApprovalQueueModal: React.FC<AdminApprovalQueueModalProps> = ({
  pendingEvents,
  onClose,
  onApprove,
  onReject,
  onDelete,
  onSelectEvent,
  onEditEvent,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingEvent, setRejectingEvent] = useState<CalendarEvent | null>(null);
  const [rejectReason, setRejectReason] = useState('Scheduling conflict or incomplete requirements');
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rejectingEvent) {
          setRejectingEvent(null);
        } else if (deletingEvent) {
          setDeletingEvent(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, rejectingEvent, deletingEvent]);

  // Group recurring requests into consolidated cards and deduplicate event IDs
  const queueItems = useMemo<ApprovalQueueItem[]>(() => {
    // 1. Strict deduplication by event id
    const seenIds = new Set<string>();
    const uniquePending = pendingEvents.filter((evt) => {
      if (seenIds.has(evt.id)) return false;
      seenIds.add(evt.id);
      return true;
    });

    // 2. Separate series from single requests
    const seriesMap = new Map<string, CalendarEvent[]>();
    const singleEvents: CalendarEvent[] = [];

    for (const evt of uniquePending) {
      if (evt.isRecurring && evt.recurringSeriesId) {
        const list = seriesMap.get(evt.recurringSeriesId) || [];
        list.push(evt);
        seriesMap.set(evt.recurringSeriesId, list);
      } else {
        singleEvents.push(evt);
      }
    }

    const items: ApprovalQueueItem[] = [];

    // Recurring series items
    for (const [seriesId, occurrences] of seriesMap.entries()) {
      occurrences.sort((a, b) => a.date.localeCompare(b.date));
      items.push({
        type: 'series',
        id: occurrences[0].id,
        leadEvent: occurrences[0],
        occurrences,
      });
    }

    // Single event items
    for (const evt of singleEvents) {
      items.push({
        type: 'single',
        id: evt.id,
        leadEvent: evt,
        occurrences: [evt],
      });
    }

    // Sort newest submission first
    items.sort(
      (a, b) =>
        new Date(b.leadEvent.submittedAt).getTime() -
        new Date(a.leadEvent.submittedAt).getTime()
    );

    return items;
  }, [pendingEvents]);

  const toggleExpandSeries = (seriesId: string) => {
    setExpandedSeries((prev) => ({ ...prev, [seriesId]: !prev[seriesId] }));
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await onApprove(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingEvent) return;
    setProcessingId(rejectingEvent.id);
    try {
      await onReject(rejectingEvent.id, rejectReason);
      setRejectingEvent(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmDelete = async (scope: 'single' | 'series' = 'single') => {
    if (!deletingEvent || !onDelete) return;
    setProcessingId(deletingEvent.id);
    setDeleteError(null);
    try {
      await onDelete(deletingEvent.id, scope);
      setDeletingEvent(null);
    } catch (err: any) {
      setDeleteError(`Failed to delete event: ${err.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-queue-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-amber-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="approval-queue-title" className="text-base font-bold text-slate-900 leading-tight">
                Administrator Approval Queue
              </h2>
              <p className="text-xs text-amber-900 font-medium">
                Review submitted requests before publishing to the public calendar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close approval queue"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Submissions List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" role="list">
          {queueItems.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Approved events are automatically broadcasted with full details to your separate <strong>Events Chat</strong>.</span>
              </span>
            </div>
          )}

          {queueItems.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCheck className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">All submissions approved!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                There are no pending requests awaiting review. New submissions will trigger an instant administrator notification.
              </p>
            </div>
          ) : (
            queueItems.map((item) => {
              const evt = item.leadEvent;
              const meta = CATEGORIES[evt.category] || CATEGORIES.other;
              const isProcessing = processingId === evt.id;
              const isSeries = item.type === 'series';
              const seriesId = evt.recurringSeriesId;
              const isExpanded = seriesId ? Boolean(expandedSeries[seriesId]) : false;

              return (
                <article
                  key={item.id}
                  role="listitem"
                  className={`p-4 bg-white rounded-xl border shadow-2xs hover:shadow-xs transition-all space-y-3 ${
                    isSeries ? 'border-purple-200 ring-1 ring-purple-100' : 'border-amber-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>

                      {isSeries && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                          <Repeat className="w-3 h-3 text-purple-600" />
                          <span>Recurring Series ({item.occurrences.length} occurrences)</span>
                        </span>
                      )}

                      {!isSeries && (evt.isMultiDay || (evt.endDate && evt.endDate > evt.date)) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          <CalendarRange className="w-3 h-3 text-indigo-600" />
                          <span>Multi-day ({calculateDaysBetween(evt.date, evt.endDate)} days)</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                        {evt.source === 'google_form' ? 'Google Form' : 'Direct Submission'}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Submitted {new Date(evt.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(evt.submittedAt).toLocaleDateString()})
                    </span>
                  </div>

                  {/* Title & Submitter */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-0.5">
                      {evt.title}
                    </h3>
                    {isSeries && evt.recurrenceRule && (
                      <p className="text-xs text-purple-900 font-semibold mb-1">
                        Schedule: {evt.recurrenceRule.humanReadable}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {evt.description || (evt.category === 'celebration' ? 'Celebration / Anniversary Announcement' : 'No description entered.')}
                    </p>
                  </div>

                  {/* Logistics badges */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {isSeries ? (
                        <span>
                          {formatDatePretty(item.occurrences[0].date)} to {formatDatePretty(item.occurrences[item.occurrences.length - 1].date)}
                          {evt.startTime ? ` (${formatTime12h(evt.startTime)}${evt.endTime ? ` - ${formatTime12h(evt.endTime)}` : ''})` : ''}
                        </span>
                      ) : (
                        <span>
                          {formatEventDateRange(evt.date, evt.endDate)}
                          {evt.startTime
                            ? ` (${formatTime12h(evt.startTime)}${evt.endTime ? ` - ${formatTime12h(evt.endTime)}` : ''})`
                            : (evt.category === 'celebration' ? ' (All Day / Celebration)' : '')}
                        </span>
                      )}
                    </span>
                    {evt.location && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {evt.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-slate-600 ml-auto">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{evt.submitterName || 'Community Member'}</span>
                      {evt.submitterEmail && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({evt.submitterEmail.startsWith('@') || evt.submitterEmail.includes('@') ? evt.submitterEmail : `@${evt.submitterEmail}`})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Series Occurrences Expander */}
                  {isSeries && seriesId && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => toggleExpandSeries(seriesId)}
                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide occurrence dates' : `View all ${item.occurrences.length} scheduled dates`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 bg-purple-50/60 rounded-lg border border-purple-200/60 flex flex-wrap gap-1.5">
                          {item.occurrences.map((occ, idx) => (
                            <span
                              key={occ.id}
                              className="px-2 py-0.5 bg-white border border-purple-200 text-purple-950 rounded text-[11px] font-medium"
                            >
                              #{idx + 1}: {formatDatePretty(occ.date)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Decision Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectEvent(evt)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      <span>Inspect Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (onEditEvent ? onEditEvent(evt) : onSelectEvent(evt))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Edit title, timing, category, or location before approving"
                      >
                        <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Edit</span>
                      </button>

                      {onDelete && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingEvent(evt);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                          title="Delete submission permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isSeries ? 'Delete Series' : 'Delete'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          setRejectReason('Scheduling conflict or incomplete requirements');
                          setRejectingEvent(evt);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isSeries ? 'Decline Series' : 'Decline'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleApprove(evt.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                        title="Approve event and dispatch details to the separate Events Chat"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isProcessing
                            ? 'Approving...'
                            : isSeries
                            ? `Approve Series (${item.occurrences.length} Events)`
                            : 'Approve & Post'}
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            {queueItems.length} submission request{queueItems.length === 1 ? '' : 's'}
            {pendingEvents.length > queueItems.length ? ` (${pendingEvents.length} total event dates)` : ''} awaiting review
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {rejectingEvent && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !processingId && setRejectingEvent(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {rejectingEvent.isRecurring ? 'Decline Recurring Series' : 'Decline Submission'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Decline &ldquo;{rejectingEvent.title}&rdquo; with an optional note.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Reason for declining</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                placeholder="Specify rejection reason..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => setRejectingEvent(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors"
              >
                {processingId ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Modal */}
      {deletingEvent && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !processingId && setDeletingEvent(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {deletingEvent.isRecurring ? 'Delete Recurring Series' : 'Delete Event'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to permanently delete this {deletingEvent.isRecurring ? 'recurring series' : 'submission'}?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 truncate">{deletingEvent.title}</div>
              <div className="text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{formatDatePretty(deletingEvent.date)}</span>
                {deletingEvent.startTime && <span>at {formatTime12h(deletingEvent.startTime)}</span>}
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => setDeletingEvent(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => handleConfirmDelete(deletingEvent.isRecurring ? 'series' : 'single')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{processingId ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
