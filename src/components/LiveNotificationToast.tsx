import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminNotification, CalendarEvent } from '../types';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  X,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';

interface LiveNotificationToastProps {
  notifications: AdminNotification[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
  onOpenApprovalQueue: () => void;
  onSelectEventById?: (eventId: string) => void;
}

export const LiveNotificationToast: React.FC<LiveNotificationToastProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onOpenApprovalQueue,
  onSelectEventById,
}) => {
  // Only show the 2 most recent unread notifications as floating toasts
  const activeToasts = notifications.filter((n) => !n.read).slice(0, 2);

  return (
    <aside
      aria-label="Live notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {activeToasts.length > 0 && onClearAll && (
        <div className="flex justify-end pointer-events-auto">
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-lg shadow-md transition-colors cursor-pointer flex items-center gap-1"
            title="Clear and dismiss all notifications"
          >
            <X className="w-3 h-3" />
            <span>Clear Notifications</span>
          </button>
        </div>
      )}
      <AnimatePresence>
        {activeToasts.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="pointer-events-auto bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 flex items-start gap-3"
            role="alert"
            aria-live="assertive"
          >
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
              {n.type === 'submission' && (
                <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
              )}
              {n.type === 'approval' && (
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
              {n.type === 'reschedule' && (
                <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </span>
              )}
              {n.type !== 'submission' && n.type !== 'approval' && n.type !== 'reschedule' && (
                <span className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-slate-100 truncate">
                  {n.title}
                </h4>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                {n.message}
              </p>

              {/* Action trigger */}
              <div className="mt-2 flex items-center gap-3">
                {n.type === 'submission' ? (
                  <button
                    onClick={() => {
                      onOpenApprovalQueue();
                      onDismiss(n.id);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 focus:underline"
                  >
                    <span>Review for Approval</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : n.eventId && onSelectEventById ? (
                  <button
                    onClick={() => {
                      onSelectEventById(n.eventId!);
                      onDismiss(n.id);
                    }}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus:underline"
                  >
                    <span>View Event Details</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => onDismiss(n.id)}
              className="text-slate-400 hover:text-white p-1 -mr-1 -mt-1 rounded-md transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
};
