import React from 'react';
import { Search, X, Filter, Calendar, Tag } from 'lucide-react';
import { EventCategory } from '../types';
import { CATEGORIES } from '../constants';

export type TimeframeFilter = 'all' | 'this_month' | 'upcoming' | 'past';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCategory: EventCategory | 'all';
  onCategoryChange: (cat: EventCategory | 'all') => void;
  timeframe: TimeframeFilter;
  onTimeframeChange: (tf: TimeframeFilter) => void;
  statusFilter: 'all' | 'approved' | 'pending';
  onStatusFilterChange: (st: 'all' | 'approved' | 'pending') => void;
  totalResults: number;
  onResetFilters: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  timeframe,
  onTimeframeChange,
  statusFilter,
  onStatusFilterChange,
  totalResults,
  onResetFilters,
}) => {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    timeframe !== 'all' ||
    statusFilter !== 'all';

  return (
    <section
      aria-label="Event search and filtering"
      className="bg-slate-50 border-b border-slate-200 py-3 px-4 sm:px-6 transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        {/* Main Search Bar & Quick Dropdowns */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="event-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title, location, description, or submitter..."
              className="w-full pl-9 pr-8 py-2 bg-white text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              aria-label="Search events"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1.5 sm:w-auto">
            <label htmlFor="timeframe-select" className="sr-only">
              Filter by timeframe
            </label>
            <div className="relative inline-flex items-center w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" aria-hidden="true" />
              <select
                id="timeframe-select"
                value={timeframe}
                onChange={(e) => onTimeframeChange(e.target.value as TimeframeFilter)}
                className="w-full sm:w-44 pl-8 pr-7 py-2 bg-white border border-slate-300 text-xs font-semibold text-slate-700 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                aria-label="Filter events by timeframe"
              >
                <option value="all">All Dates</option>
                <option value="this_month">This Calendar Month</option>
                <option value="upcoming">Upcoming & Future</option>
                <option value="past">Past Events</option>
              </select>
              <div className="absolute right-2.5 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1.5 sm:w-auto">
            <label htmlFor="status-select" className="sr-only">
              Filter by approval status
            </label>
            <div className="relative inline-flex items-center w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" aria-hidden="true" />
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as any)}
                className="w-full sm:w-40 pl-8 pr-7 py-2 bg-white border border-slate-300 text-xs font-semibold text-slate-700 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                aria-label="Filter events by approval status"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved Only</option>
                <option value="pending">Pending Approval</option>
              </select>
              <div className="absolute right-2.5 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-200/80 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              aria-label="Reset all search filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="radiogroup" aria-label="Filter by event category">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1 mr-1 shrink-0">
            <Tag className="w-3 h-3" /> Category:
          </span>

          <button
            role="radio"
            aria-checked={selectedCategory === 'all'}
            onClick={() => onCategoryChange('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md shrink-0 transition-all border ${
              selectedCategory === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            All Categories
          </button>

          {Object.values(CATEGORIES).map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => onCategoryChange(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md shrink-0 transition-all border ${
                  isSelected
                    ? `${cat.bgSolid} text-white border-transparent shadow-2xs`
                    : `bg-white ${cat.textClass} ${cat.borderClass} hover:bg-slate-50`
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : cat.dotClass}`}
                  aria-hidden="true"
                />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Screen Reader Results Notification */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-slate-500 font-medium flex items-center justify-between"
        >
          <span>
            Showing <strong className="text-slate-800">{totalResults}</strong> {totalResults === 1 ? 'event' : 'events'}
            {hasActiveFilters && ' matching current filters'}
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] text-indigo-600 font-semibold">Filters active</span>
          )}
        </div>
      </div>
    </section>
  );
};
