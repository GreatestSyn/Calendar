import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  PlusCircle,
  FileSpreadsheet,
  ShieldCheck,
  Send,
  Radio,
  ListFilter,
  Grid,
  Image as ImageIcon,
  KeyRound,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from 'lucide-react';
import { AuthUser } from '../types';
import { useTheme } from '../context/ThemeContext';

interface CalendarHeaderProps {
  currentMonthDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  pendingCount: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isTelegramConfigured: boolean;
  onOpenSubmitModal: () => void;
  onOpenGoogleFormModal: () => void;
  onOpenApprovalQueue: () => void;
  onOpenTelegramSettings: () => void;
  onOpenMonthlyBroadcast: () => void;
  viewMode: 'grid' | 'list';
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  // Authentication & Permissions props
  currentUser: AuthUser | null;
  effectiveIsAdmin: boolean;
  isRealAdmin: boolean;
  isViewingAsUser: boolean;
  onToggleViewAsUser: () => void;
  onOpenAuthModal: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentMonthDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  pendingCount,
  connectionStatus,
  isTelegramConfigured,
  onOpenSubmitModal,
  onOpenGoogleFormModal,
  onOpenApprovalQueue,
  onOpenTelegramSettings,
  onOpenMonthlyBroadcast,
  viewMode,
  onToggleViewMode,
  currentUser,
  effectiveIsAdmin,
  isRealAdmin,
  isViewingAsUser,
  onToggleViewAsUser,
  onOpenAuthModal,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const monthName = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 shadow-xs sticky top-0 z-20 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-2.5 mr-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <CalendarIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Live Event Calendar
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="capitalize">{connectionStatus === 'connected' ? 'Real-time Sync Active' : connectionStatus}</span>
              </div>
            </div>
          </div>

          {/* Month Stepper */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700" role="group" aria-label="Month navigation">
            <button
              onClick={onPrevMonth}
              className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200 min-w-[140px] text-center select-none"
              aria-live="polite"
            >
              {monthName}
            </span>
            <button
              onClick={onNextMonth}
              className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Today
          </button>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700" role="tablist" aria-label="View switcher">
            <button
              role="tab"
              aria-selected={viewMode === 'grid'}
              onClick={() => onToggleViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Grid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Month Grid</span>
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => onToggleViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Month List</span>
            </button>
          </div>
        </div>

        {/* Right: Key Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Admin-Only Tools (Hidden in public or preview mode) */}
          {effectiveIsAdmin && (
            <>
              {/* Admin Approval Queue Button */}
              <button
                onClick={onOpenApprovalQueue}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  pendingCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 shadow-2xs ring-1 ring-amber-400/50'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs'
                } focus:outline-none focus:ring-2 focus:ring-amber-500`}
                aria-label={`Administrator approval queue with ${pendingCount} pending submissions`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>Approvals</span>
                {pendingCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-bold leading-none text-white bg-amber-600 rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>

              {/* Telegram Notifications Button */}
              <button
                onClick={onOpenTelegramSettings}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  isTelegramConfigured
                    ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/50 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs'
                } focus:outline-none focus:ring-2 focus:ring-sky-500`}
                aria-label="Telegram notification settings"
              >
                <Send className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <span className="hidden sm:inline">Telegram Alerts</span>
                <span className="sm:hidden">Telegram</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isTelegramConfigured ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              </button>

              {/* Export & Monthly Broadcast to Events Chat */}
              <button
                onClick={onOpenMonthlyBroadcast}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Export calendar as image and post monthly summary to events chat"
                title="Export calendar as image and post to Telegram events chat"
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <span className="hidden lg:inline">Export & Events Chat</span>
                <span className="lg:hidden">Export / Post</span>
              </button>

              {/* Google Form Integration Setup */}
              <button
                onClick={onOpenGoogleFormModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Google Form integration instructions and simulator"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="hidden md:inline">Google Form Setup</span>
                <span className="md:hidden">Form Setup</span>
              </button>
            </>
          )}

          {/* Direct Submit Event (Accessible to everyone) */}
          <button
            onClick={onOpenSubmitModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            aria-label="Submit a new event"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Submit Event</span>
          </button>

          {/* Admin "View as User" Toggle Switch */}
          {isRealAdmin && (
            <button
              onClick={onToggleViewAsUser}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
                isViewingAsUser
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              } focus:outline-none focus:ring-2 focus:ring-amber-500`}
              title={isViewingAsUser ? 'Viewing as public visitor. Click to return to Admin View.' : 'Preview the calendar as a public visitor'}
            >
              {isViewingAsUser ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span className="hidden md:inline">Exit Visitor View</span>
                  <span className="md:hidden">Admin View</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="hidden md:inline">View as User</span>
                  <span className="md:hidden">User View</span>
                </>
              )}
            </button>
          )}

          {/* Theme Toggle Button (Dark / Light mode) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" aria-hidden="true" />
            )}
          </button>

          {/* User Account / Sign In Trigger */}
          {currentUser ? (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Account settings & sign out"
            >
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-300 dark:border-slate-600"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[100px] truncate hidden sm:inline">
                {currentUser.name.split(' ')[0]}
              </span>
              {currentUser.role === 'admin' ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  Admin
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Viewer
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Sign in"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
