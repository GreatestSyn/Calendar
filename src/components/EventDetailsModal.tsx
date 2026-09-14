import React, { useEffect, useState } from 'react';
import { CalendarEvent, EventCategory } from '../types';
import { CATEGORIES, formatTime12h, formatDatePretty, calculateDaysBetween, formatEventDateRange } from '../constants';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Send,
  Trash2,
  FileSpreadsheet,
  Users,
  Wrench,
  AlertTriangle,
  ExternalLink,
  Pencil,
  Save,
  Undo2,
  ChevronDown,
  ChevronUp,
  Tag,
  Sparkles,
  Download,
  CalendarPlus,
  Repeat,
  CalendarRange,
} from 'lucide-react';
import {
  downloadIcsFile,
  getGoogleCalendarUrl,
  getOutlookLiveUrl,
  getOffice365Url,
  getYahooCalendarUrl
} from '../utils/calendarExport';
import { postApprovedEventToTelegram } from '../services/api';

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  initialEditMode?: boolean;
  onClose: () => void;
  onApprove: (id: string, updates?: Partial<CalendarEvent>) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onUpdate?: (id: string, patch: Partial<CalendarEvent>, scope?: 'single' | 'series') => Promise<void>;
  onOpenReschedule: (event: CalendarEvent) => void;
  onSendTelegramAlert: (event: CalendarEvent) => Promise<void>;
  onDelete: (id: string, scope?: 'single' | 'series') => Promise<void>;
  isTelegramConfigured: boolean;
  isAdmin?: boolean;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  initialEditMode = false,
  onClose,
  onApprove,
  onReject,
  onUpdate,
  onOpenReschedule,
  onSendTelegramAlert,
  onDelete,
  isTelegramConfigured,
  isAdmin = false,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditMode && isAdmin);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);
  const [showRawAnswers, setShowRawAnswers] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editScope, setEditScope] = useState<'single' | 'series'>('single');

  const handleDownloadIcs = () => {
    if (!event) return;
    try {
      downloadIcsFile(event);
      setDownloadFeedback('Downloaded .ics file to your personal device!');
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to export calendar file', err);
    }
  };

  // Editable Form State
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<EventCategory>('SAKK Event');
  const [editDate, setEditDate] = useState('');
  const [editIsMultiDay, setEditIsMultiDay] = useState(false);
  const [editEndDate, setEditEndDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitterName, setEditSubmitterName] = useState('');
  const [editSubmitterEmail, setEditSubmitterEmail] = useState('');
  const [editAttendees, setEditAttendees] = useState('');
  const [editEquipment, setEditEquipment] = useState('');

  // Sync state with incoming event
  useEffect(() => {
    if (event) {
      setEditTitle(event.title || '');
      setEditCategory(event.category || 'SAKK Event');
      setEditDate(event.date || '');
      setEditIsMultiDay(Boolean(event.isMultiDay || (event.endDate && event.endDate > event.date)));
      setEditEndDate(event.endDate || event.date || '');
      setEditStartTime(event.startTime || '09:00');
      setEditEndTime(event.endTime || '10:00');
      setEditLocation(event.location || '');
      setEditDescription(event.description || '');
      setEditSubmitterName(event.submitterName || '');
      setEditSubmitterEmail(event.submitterEmail || '');
      setEditAttendees(String(event.expectedAttendees || ''));
      setEditEquipment(event.equipmentNeeds || '');
      setIsEditing(Boolean(initialEditMode && isAdmin));
      setEditError(null);
      setEditSuccessMessage(null);
      setRejecting(false);
    }
  }, [event, initialEditMode, isAdmin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const currentCategory = isEditing ? editCategory : event.category;
  const meta = CATEGORIES[currentCategory] || CATEGORIES.other;
  const isPending = event.status === 'pending';
  const isApproved = event.status === 'approved';
  const isRejected = event.status === 'rejected';

  const getSanitizedUpdates = (): Partial<CalendarEvent> | null => {
    const trimmedTitle = editTitle.trim();
    const trimmedDate = editDate.trim();
    const trimmedLocation = editLocation.trim();
    const trimmedDescription = editDescription.trim();
    const trimmedName = editSubmitterName.trim();
    let trimmedHandle = editSubmitterEmail.trim();

    if (!trimmedTitle) {
      setEditError('Event Title cannot be empty.');
      return null;
    }
    if (!trimmedDate) {
      setEditError('Event Date cannot be empty.');
      return null;
    }

    const isCelebration = editCategory === 'celebration';

    if (isCelebration) {
      // For celebration events, only title, category, and date are required.
      // Other fields are optional. If both times are provided, validate start < end.
      if (editStartTime && editEndTime && editStartTime >= editEndTime) {
        setEditError('Start time must be strictly before end time.');
        return null;
      }
    } else {
      if (!editStartTime || !editEndTime) {
        setEditError('Start and End times are required.');
        return null;
      }
      if (editStartTime >= editEndTime) {
        setEditError('Start time must be strictly before end time.');
        return null;
      }
      if (!trimmedLocation) {
        setEditError('Location or Virtual Meeting Link is required.');
        return null;
      }
      if (!trimmedDescription) {
        setEditError('Event Description cannot be empty.');
        return null;
      }
      if (!trimmedName) {
        setEditError('Preferred Name is required.');
        return null;
      }
      if (!trimmedHandle) {
        setEditError('Telegram Handle is required.');
        return null;
      }
    }

    if (editIsMultiDay && editEndDate && editEndDate < trimmedDate) {
      setEditError('End Date cannot be earlier than Start Date.');
      return null;
    }

    if (trimmedHandle && !trimmedHandle.startsWith('@') && !trimmedHandle.includes('@')) {
      trimmedHandle = `@${trimmedHandle}`;
    }

    setEditError(null);
    return {
      title: trimmedTitle,
      category: editCategory,
      date: trimmedDate,
      endDate: editIsMultiDay && editEndDate > trimmedDate ? editEndDate : undefined,
      isMultiDay: Boolean(editIsMultiDay && editEndDate > trimmedDate),
      startTime: editStartTime.trim(),
      endTime: editEndTime.trim(),
      location: trimmedLocation || (isCelebration ? 'Celebration Announcement' : ''),
      description: trimmedDescription || (isCelebration ? 'Celebration / Anniversary Announcement' : ''),
      submitterName: trimmedName || (isCelebration ? 'Celebration Announcement' : ''),
      submitterEmail: trimmedHandle || (isCelebration ? '@community' : ''),
      expectedAttendees: editAttendees.trim(),
      equipmentNeeds: editEquipment.trim(),
    };
  };

  const handleApproveDirect = async () => {
    setActionLoading(true);
    try {
      await onApprove(event.id);
      onClose();
    } catch (err: any) {
      setEditError(`Approval error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAndApprove = async () => {
    const updates = getSanitizedUpdates();
    if (!updates) return;

    setActionLoading(true);
    try {
      await onApprove(event.id, updates);
      onClose();
    } catch (err: any) {
      setEditError(`Approval error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveOnly = async () => {
    const updates = getSanitizedUpdates();
    if (!updates) return;

    setActionLoading(true);
    try {
      if (onUpdate) {
        await onUpdate(event.id, updates, editScope);
      }
      setIsEditing(false);
      setEditSuccessMessage(
        editScope === 'series'
          ? 'Changes applied across all events in this recurring series.'
          : 'Event details saved successfully.'
      );
    } catch (err: any) {
      setEditError(`Save error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(event.title || '');
    setEditCategory(event.category || 'SAKK Event');
    setEditDate(event.date || '');
    setEditStartTime(event.startTime || '09:00');
    setEditEndTime(event.endTime || '10:00');
    setEditLocation(event.location || '');
    setEditDescription(event.description || '');
    setEditSubmitterName(event.submitterName || '');
    setEditSubmitterEmail(event.submitterEmail || '');
    setEditAttendees(String(event.expectedAttendees || ''));
    setEditEquipment(event.equipmentNeeds || '');
    setEditError(null);
    setIsEditing(false);
  };

  const handleConfirmReject = async () => {
    setActionLoading(true);
    try {
      await onReject(event.id, rejectReason || 'Administrative decision');
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTelegram = async () => {
    setActionLoading(true);
    setTelegramStatus(null);
    try {
      await onSendTelegramAlert(event);
      setTelegramStatus('Telegram alert delivered successfully!');
    } catch (err: any) {
      setTelegramStatus(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostToEventsChat = async () => {
    setActionLoading(true);
    setTelegramStatus(null);
    try {
      const res = await postApprovedEventToTelegram(event.id);
      if (res.success) {
        setTelegramStatus(`Posted to Events Chat (${res.postedToChat || 'configured chat'}) successfully!`);
      } else {
        setTelegramStatus(`Failed to post: ${res.error}`);
      }
    } catch (err: any) {
      setTelegramStatus(`Error posting: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async (scope: 'single' | 'series') => {
    setActionLoading(true);
    setEditError(null);
    try {
      await onDelete(event.id, scope);
      setShowDeleteModal(false);
      onClose();
    } catch (err: any) {
      setEditError(`Failed to delete event: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    setEditError(null);
    setShowDeleteModal(true);
  };

  const isUrlLocation =
    event.location?.startsWith('http://') ||
    event.location?.startsWith('https://');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Color Accent Bar */}
        <div className={`h-2.5 w-full ${meta.bgSolid}`} />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold uppercase rounded-md border ${meta.bgLight} ${meta.textClass} ${meta.borderClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                {meta.label}
              </span>

              {/* Status Badge */}
              {isPending && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Awaiting Administrator Approval
                </span>
              )}
              {isApproved && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Approved & Scheduled
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-rose-100 text-rose-900 border border-rose-300">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  Declined
                </span>
              )}

              {/* Multi-day Badge */}
              {Boolean(event.isMultiDay || (event.endDate && event.endDate > event.date)) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300">
                  <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                  Multi-day ({calculateDaysBetween(event.date, event.endDate)} days)
                </span>
              )}

              {/* Recurring Badge */}
              {Boolean(event.isRecurring || event.recurringSeriesId) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300">
                  <Repeat className="w-3 h-3 text-indigo-600" />
                  Recurring
                  {event.recurrenceIndex && event.recurrenceTotal && (
                    <span className="text-[10px] opacity-75">
                      ({event.recurrenceIndex}/{event.recurrenceTotal})
                    </span>
                  )}
                </span>
              )}

              {/* Edit Mode Indicator */}
              {isEditing && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse">
                  <Pencil className="w-3 h-3 text-indigo-600" />
                  Admin Edit Mode
                </span>
              )}

              {/* Source Pill */}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                Google Form
              </span>
            </div>

            <h2 id="event-details-title" className="text-xl font-bold text-slate-900 leading-tight truncate">
              {isEditing ? 'Edit Event Details' : event.title}
            </h2>
            {isEditing && (
              <p className="text-xs text-slate-500">
                Adjust event information, timing, venue, or submitter details before approving.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors shadow-2xs"
                title="Edit event details"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                <span>Edit</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Close event details dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Success Message Banner */}
          {editSuccessMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-900 text-xs rounded-xl border border-emerald-200 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{editSuccessMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {editError && (
            <div className="p-3 bg-rose-50 text-rose-900 text-xs rounded-xl border border-rose-200 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          {/* EDIT FORM MODE */}
          {isEditing ? (
            <form
              id="admin-event-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (isPending) {
                  handleSaveAndApprove();
                } else {
                  handleSaveOnly();
                }
              }}
              className="space-y-4"
            >
              {/* Celebration Mode Banner */}
              {editCategory === 'celebration' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Celebration / Anniversary Event Mode:</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Only <strong>Title</strong>, <strong>Category</strong>, and <strong>Date</strong> are required. Times, venue, description, and submitter info remain optional for milestone announcements.
                    </p>
                  </div>
                </div>
              )}

              {/* Event Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={editCategory === 'celebration' ? 'e.g., SAKK 10th Anniversary' : 'e.g., SAKK Committee Strategy Alignment'}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Category & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Event Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as EventCategory)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {Object.entries(CATEGORIES).map(([key, cMeta]) => (
                      <option key={key} value={key}>
                        {cMeta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Location / Meeting Link {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder={editCategory === 'celebration' ? 'Optional (e.g. Main Hall or leave blank)' : 'e.g. Conference Room Alpha or Meet link'}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required={editCategory !== 'celebration'}
                  />
                </div>
              </div>

              {/* Date, Multi-day toggle, Start Time, End Time */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {editIsMultiDay ? 'Start Date' : 'Date'} <span className="text-rose-500">*</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editIsMultiDay}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditIsMultiDay(checked);
                            if (checked && (!editEndDate || editEndDate < editDate)) {
                              setEditEndDate(editDate);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-semibold text-slate-600">Multi-day</span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setEditDate(newStart);
                        if (editIsMultiDay && editEndDate < newStart) {
                          setEditEndDate(newStart);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  {editIsMultiDay ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                          End Date <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                          {calculateDaysBetween(editDate, editEndDate)} days
                        </span>
                      </div>
                      <input
                        type="date"
                        min={editDate}
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Start Time {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required={editCategory !== 'celebration'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      End Time {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required={editCategory !== 'celebration'}
                    />
                  </div>
                </div>
              </div>

              {/* Event Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Event Description {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={editCategory === 'celebration' ? 'Optional anniversary announcement description...' : 'Provide comprehensive details about agenda, audience, and preparation...'}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  required={editCategory !== 'celebration'}
                />
              </div>

              {/* Submitter Details: Preferred Name & Telegram Handle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Preferred Name {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editSubmitterName}
                    onChange={(e) => setEditSubmitterName(e.target.value)}
                    placeholder={editCategory === 'celebration' ? 'Optional (e.g. Sarah Jenkins)' : 'e.g., Sarah Jenkins'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required={editCategory !== 'celebration'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Telegram Handle {editCategory === 'celebration' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editSubmitterEmail}
                    onChange={(e) => setEditSubmitterEmail(e.target.value)}
                    placeholder={editCategory === 'celebration' ? 'Optional (e.g. @sarah_j)' : 'e.g., @sarah_j'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required={editCategory !== 'celebration'}
                  />
                </div>
              </div>

              {/* Expected Attendees & Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Expected Attendees <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editAttendees}
                    onChange={(e) => setEditAttendees(e.target.value)}
                    placeholder="e.g. 25 participants"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Equipment Needs <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editEquipment}
                    onChange={(e) => setEditEquipment(e.target.value)}
                    placeholder="e.g. Projector, wireless mics"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Recurring Scope Selector if event is part of a series */}
              {Boolean(event.isRecurring || event.recurringSeriesId) && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apply Updates Scope</span>
                  </div>
                  <p className="text-[11px] text-indigo-800">
                    Choose whether editing updates this specific calendar occurrence or all future sessions in this recurring series.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <label
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        editScope === 'single'
                          ? 'bg-white border-indigo-500 shadow-xs font-semibold text-indigo-950 ring-1 ring-indigo-500'
                          : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="editScope"
                        value="single"
                        checked={editScope === 'single'}
                        onChange={() => setEditScope('single')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">This event only</div>
                        <div className="text-[10px] text-slate-500">Only affects {event.date}</div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        editScope === 'series'
                          ? 'bg-white border-indigo-500 shadow-xs font-semibold text-indigo-950 ring-1 ring-indigo-500'
                          : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="editScope"
                        value="series"
                        checked={editScope === 'series'}
                        onChange={() => setEditScope('series')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">All events in series</div>
                        <div className="text-[10px] text-slate-500">Updates title, venue, times & description</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Collapsible Original Google Form Reference */}
              {event.rawFormAnswers && Object.keys(event.rawFormAnswers).length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowRawAnswers(!showRawAnswers)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{showRawAnswers ? 'Hide' : 'View'} Original Google Form Submission Answers</span>
                    {showRawAnswers ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showRawAnswers && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100 text-slate-700 text-left font-semibold">
                          <tr>
                            <th className="px-3 py-2">Question</th>
                            <th className="px-3 py-2">Submitted Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {Object.entries(event.rawFormAnswers).map(([q, a]) => (
                            <tr key={q}>
                              <td className="px-3 py-2 font-medium text-slate-600">{q}</td>
                              <td className="px-3 py-2 text-slate-900">{String(a)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </form>
          ) : (
            /* READ-ONLY VIEW MODE */
            <>
              {/* Pending Review Notice with Edit CTA */}
              {isPending && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Pending Administrator Approval</p>
                      <p className="mt-0.5 text-amber-800">
                        Review submitted details before approving. You can edit the title, timing, category, venue, or description at any time.
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors border border-amber-300 shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  )}
                </div>
              )}

              {/* Recurring Event Schedule Banner */}
              {Boolean(event.isRecurring || event.recurringSeriesId) && (
                <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-indigo-950 flex items-center gap-2">
                        <span>{event.recurrenceRule?.humanReadable || 'Recurring Scheduled Event'}</span>
                        {event.recurrenceIndex && event.recurrenceTotal && (
                          <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                            Occurrence {event.recurrenceIndex} of {event.recurrenceTotal}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-0.5">
                        This event repeats automatically according to the verified community schedule rule.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Core Event Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    {(event.isMultiDay || (event.endDate && event.endDate > event.date)) ? (
                      <CalendarRange className="w-4 h-4" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">
                      Scheduled Date{(event.isMultiDay || (event.endDate && event.endDate > event.date)) ? ' Range' : ''}
                    </div>
                    <div className="font-bold text-slate-900">{formatEventDateRange(event.date, event.endDate)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Time Window</div>
                    <div className="font-bold text-slate-900">
                      {event.startTime
                        ? `${formatTime12h(event.startTime)}${event.endTime ? ` - ${formatTime12h(event.endTime)}` : ''}`
                        : (event.category === 'celebration' ? 'All Day / Celebration Announcement' : 'Untimed Event')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 sm:col-span-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-500 font-medium">Venue / Virtual Link</div>
                    {isUrlLocation ? (
                      <a
                        href={event.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-indigo-600 hover:underline flex items-center gap-1 truncate"
                      >
                        <span>{event.location}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <div className="font-bold text-slate-900 truncate">{event.location || 'Not specified'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Add to Personal Calendar Card */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-sky-50/80 rounded-xl border border-indigo-200/70 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <CalendarPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Add to Personal Calendar</h4>
                      <p className="text-[11px] text-slate-500">
                        Download the calendar file (.ics) or sync directly with Google, Apple, or Outlook.
                      </p>
                    </div>
                  </div>
                  {downloadFeedback && (
                    <span className="self-start sm:self-center text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-2xs animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{downloadFeedback}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Universal iCal (.ics) Download */}
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-lg text-center transition-all group shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Download universal iCalendar file (.ics) for Apple Calendar, Outlook, iOS, Android, and desktop apps"
                  >
                    <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">🍏</span>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Download className="w-3 h-3 text-indigo-600" />
                      iCal (.ics)
                    </span>
                    <span className="text-[10px] text-slate-500">Apple & Universal</span>
                  </button>

                  {/* Google Calendar Web */}
                  <a
                    href={getGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-lg text-center transition-all group shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Add directly to Google Calendar in a new tab"
                  >
                    <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">📅</span>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-blue-600" />
                      Google Cal
                    </span>
                    <span className="text-[10px] text-slate-500">Open in browser</span>
                  </a>

                  {/* Outlook / Live */}
                  <a
                    href={getOutlookLiveUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 rounded-lg text-center transition-all group shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    title="Add to personal Outlook.com / Hotmail calendar"
                  >
                    <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">📬</span>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-sky-600" />
                      Outlook
                    </span>
                    <span className="text-[10px] text-slate-500">Personal Web</span>
                  </a>

                  {/* Office 365 */}
                  <a
                    href={getOffice365Url(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-lg text-center transition-all group shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Add to Microsoft 365 work or school calendar"
                  >
                    <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">💼</span>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-indigo-600" />
                      Office 365
                    </span>
                    <span className="text-[10px] text-slate-500">Work & School</span>
                  </a>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Event Description
                </h3>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {event.description || 'No description provided by submitter.'}
                </div>
              </div>

              {/* Submitter & Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Submitter Info */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Submitter Details
                  </h4>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Preferred Name:</span>
                    <strong className="text-slate-800">{event.submitterName}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Telegram Handle:</span>
                    {event.submitterEmail.startsWith('@') || (!event.submitterEmail.includes('@') && !event.submitterEmail.includes('.')) ? (
                      <a
                        href={`https://t.me/${event.submitterEmail.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/60"
                      >
                        <Send className="w-3 h-3 text-indigo-500" />
                        <span>{event.submitterEmail.startsWith('@') ? event.submitterEmail : `@${event.submitterEmail}`}</span>
                      </a>
                    ) : (
                      <a
                        href={`mailto:${event.submitterEmail}`}
                        className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        {event.submitterEmail}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                    <span>Submitted At:</span>
                    <span>{new Date(event.submittedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Event Logistics */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Logistics & Equipment
                  </h4>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Expected Attendees:</span>
                    <strong className="text-slate-800">{event.expectedAttendees || 'Unspecified'}</strong>
                  </div>
                  <div className="flex items-start justify-between text-slate-600 gap-2">
                    <span className="shrink-0 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Equipment:
                    </span>
                    <span className="text-slate-800 text-right font-medium">
                      {event.equipmentNeeds || 'None requested'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Raw Google Form Answers Preview */}
              {event.rawFormAnswers && Object.keys(event.rawFormAnswers).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Google Form Submissions Breakdown
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-100 text-slate-700 text-left font-semibold">
                        <tr>
                          <th className="px-3 py-2">Form Question</th>
                          <th className="px-3 py-2">Submitted Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.entries(event.rawFormAnswers).map(([question, answer]) => (
                          <tr key={question}>
                            <td className="px-3 py-2 font-medium text-slate-600">{question}</td>
                            <td className="px-3 py-2 text-slate-900">{String(answer)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Telegram Status message */}
          {telegramStatus && (
            <div className="p-3 bg-sky-50 text-sky-900 text-xs rounded-lg border border-sky-200 font-medium">
              {telegramStatus}
            </div>
          )}

          {/* Reject confirmation box */}
          {rejecting && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
              <h4 className="text-xs font-bold text-rose-900">Provide reason for declining this event:</h4>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Scheduling conflict, duplicate submission, venue unavailable..."
                className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={2}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmReject}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs"
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Toolbar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
          {/* In Edit Mode */}
          {isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Cancel Editing</span>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg shadow-2xs transition-colors"
                  title="Delete event from calendar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isPending ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveOnly}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors"
                      title="Save edits while keeping event in pending review"
                    >
                      <Save className="w-3.5 h-3.5 text-slate-600" />
                      <span>Save (Keep Pending)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAndApprove}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoading ? 'Saving & Approving...' : 'Save & Approve'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveOnly}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>{actionLoading ? 'Saving Changes...' : 'Save Updated Details'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* In View Mode */
            <>
              {/* Left Actions: Export, Reschedule, Alert, Delete */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Download / Add to Calendar Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-colors"
                    title="Download or sync this event with your personal calendar"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Add to Calendar</span>
                    <ChevronDown className="w-3 h-3 text-indigo-500" />
                  </button>

                  {showCalendarMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowCalendarMenu(false)}
                      />
                      <div className="absolute left-0 bottom-full mb-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs text-slate-700 animate-in fade-in slide-in-from-bottom-2">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          Export to Personal Calendar
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCalendarMenu(false);
                            handleDownloadIcs();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold flex items-center gap-2">
                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                            Download .ics File
                          </span>
                          <span className="text-[10px] text-slate-400">Apple / Default</span>
                        </button>
                        <a
                          href={getGoogleCalendarUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                            Google Calendar
                          </span>
                          <span className="text-[10px] text-slate-400">Web</span>
                        </a>
                        <a
                          href={getOutlookLiveUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                            Outlook.com
                          </span>
                          <span className="text-[10px] text-slate-400">Personal</span>
                        </a>
                        <a
                          href={getOffice365Url(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                            Microsoft 365
                          </span>
                          <span className="text-[10px] text-slate-400">Work/School</span>
                        </a>
                        <a
                          href={getYahooCalendarUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition-colors border-t border-slate-100"
                        >
                          <span className="font-semibold flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                            Yahoo Calendar
                          </span>
                          <span className="text-[10px] text-slate-400">Web</span>
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {isAdmin && (
                  <>
                    <button
                      onClick={() => onOpenReschedule(event)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
                      title="Change event date or time"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Reschedule</span>
                    </button>

                    {/* Telegram Reminder button */}
                    <button
                      onClick={handleSendTelegram}
                      disabled={actionLoading}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border shadow-2xs transition-colors ${
                        isTelegramConfigured
                          ? 'text-sky-800 bg-sky-50 border-sky-300 hover:bg-sky-100'
                          : 'text-slate-600 bg-white border-slate-300 hover:bg-slate-50'
                      }`}
                      title="Send Telegram notification reminder for this event"
                    >
                      <Send className="w-3.5 h-3.5 text-sky-600" />
                      <span>Admin Alert</span>
                    </button>

                    {!isPending && (
                      <button
                        onClick={handlePostToEventsChat}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg shadow-2xs transition-colors"
                        title="Post this approved event directly to the dedicated Events Chat"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Post to Events Chat</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs transition-colors"
                      aria-label="Delete event"
                      title={event.isRecurring || event.recurringSeriesId ? 'Delete this occurrence or entire series' : 'Delete event from calendar'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>

              {/* Right Actions: Approval controls */}
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Edit Details</span>
                    </button>

                    {isPending && !rejecting && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejecting(true)}
                          disabled={actionLoading}
                          className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveDirect}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                          title="Approve event and post details to the separate Events Chat"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Post to Events Chat</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors shadow-2xs"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation In-App Dialog Overlay */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={() => !actionLoading && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 id="delete-dialog-title" className="text-base font-bold text-slate-900 leading-snug">
                  {Boolean(event.isRecurring || event.recurringSeriesId)
                    ? 'Delete Recurring Event'
                    : 'Delete Event'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {Boolean(event.isRecurring || event.recurringSeriesId)
                    ? 'This event repeats on a schedule. Choose whether to remove only this single session or the entire recurring series.'
                    : 'Are you sure you want to delete this event? This action will permanently remove it from the calendar.'}
                </p>
              </div>
            </div>

            {/* Event Details Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 line-clamp-1">{event.title}</div>
              <div className="text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{formatDatePretty(event.date)}</span>
                {event.startTime && <span>at {formatTime12h(event.startTime)}</span>}
              </div>
              {event.location && (
                <div className="text-slate-500 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {editError}
              </div>
            )}

            {/* Recurring options vs Single event actions */}
            {Boolean(event.isRecurring || event.recurringSeriesId) ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDeleteConfirm('single')}
                  className="w-full text-left p-3 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <div>
                    <div className="font-bold">Delete this session only</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Only removes session on {event.date}. Other occurrences remain scheduled.
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0 ml-2">
                    1 Event
                  </span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDeleteConfirm('series')}
                  className="w-full text-left p-3 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <div>
                    <div className="font-bold">Delete entire recurring series</div>
                    <div className="text-[11px] text-rose-600 font-normal mt-0.5">
                      Removes all occurrences in series ({event.recurrenceRule?.humanReadable || 'Recurring'}).
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-800 shrink-0 ml-2">
                    All Sessions
                  </span>
                </button>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDeleteConfirm('single')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Deleting...' : 'Yes, Delete Event'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
