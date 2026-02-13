'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// Generate an array of {year, month} objects for a range of months
function generateMonths(centerDate: Date, before: number, after: number): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const start = new Date(centerDate.getFullYear(), centerDate.getMonth() - before, 1);
  const total = before + after + 1;
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

// ── Month Grid (single month in the scroll list) ────────────────────────────

interface MonthGridProps {
  year: number;
  month: number;
  today: Date;
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  hovered?: Date | null;
  onSelect: (d: Date) => void;
  onHover?: (d: Date | null) => void;
  isRange?: boolean;
}

function MonthGrid({ year, month, today, selected, rangeStart, rangeEnd, hovered, onSelect, onHover, isRange }: MonthGridProps) {
  const days = getDaysInMonth(year, month);
  const startDay = days[0].getDay();
  const blanks = Array.from({ length: startDay });

  function getRangeState(d: Date): 'start' | 'end' | 'mid' | 'none' {
    if (!isRange) return 'none';
    const s = rangeStart;
    const e = rangeEnd || (hovered && s && !rangeEnd ? hovered : null);
    if (!s || !e) return 'none';
    const [lo, hi] = s.getTime() <= e.getTime() ? [s, e] : [e, s];
    if (isSameDay(d, lo)) return 'start';
    if (isSameDay(d, hi)) return 'end';
    if (isBetween(d, lo, hi)) return 'mid';
    return 'none';
  }

  return (
    <div className="grid grid-cols-7">
      {blanks.map((_, i) => <div key={`b-${i}`} />)}
      {days.map(d => {
        const isToday = isSameDay(d, today);
        const isSelected = (selected && isSameDay(d, selected)) ||
          (rangeStart && isSameDay(d, rangeStart)) ||
          (rangeEnd && isSameDay(d, rangeEnd));
        const range = getRangeState(d);

        let cellBg = '';
        if (range === 'mid') cellBg = 'bg-blue-50';
        if (range === 'start') cellBg = 'bg-blue-50 rounded-l-lg';
        if (range === 'end') cellBg = 'bg-blue-50 rounded-r-lg';

        return (
          <div key={d.getTime()} className={`relative ${cellBg}`}>
            <button
              type="button"
              onClick={() => onSelect(d)}
              onMouseEnter={() => onHover?.(d)}
              onMouseLeave={() => onHover?.(null)}
              className={`
                w-full aspect-square flex items-center justify-center text-[13px] rounded-lg transition-all
                ${isSelected
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : isToday
                    ? 'text-blue-600 font-semibold ring-1 ring-blue-300'
                    : 'text-gray-700 hover:bg-blue-50'
                }
              `}
            >
              {d.getDate()}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Infinite Scroll Calendar ────────────────────────────────────────────────

interface ScrollCalendarProps {
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  hovered?: Date | null;
  onSelect: (d: Date) => void;
  onHover?: (d: Date | null) => void;
  isRange?: boolean;
  onClose?: () => void;
  pastMonths?: number;
  futureMonths?: number;
}

function ScrollCalendar({ selected, rangeStart, rangeEnd, hovered, onSelect, onHover, isRange, onClose, pastMonths = 12, futureMonths = 24 }: ScrollCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const focusDate = selected || rangeStart || today;
  const months = useMemo(() => generateMonths(focusDate, pastMonths, futureMonths), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [visibleMonth, setVisibleMonth] = useState({ year: focusDate.getFullYear(), month: focusDate.getMonth() });
  const [showJumper, setShowJumper] = useState(false);
  const [jumperYear, setJumperYear] = useState(focusDate.getFullYear());
  const initialScrollDone = useRef(false);

  // Scroll to focus month on mount
  useEffect(() => {
    if (initialScrollDone.current) return;
    const key = monthKey(focusDate.getFullYear(), focusDate.getMonth());
    const el = monthRefs.current.get(key);
    if (el && scrollRef.current) {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start' });
        initialScrollDone.current = true;
      });
    }
  }, []);

  // IntersectionObserver to detect which month is in view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
        }
        if (best) {
          const key = (best.target as HTMLElement).dataset.month;
          if (key) {
            const [y, m] = key.split('-').map(Number);
            setVisibleMonth({ year: y, month: m - 1 });
          }
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    monthRefs.current.forEach((el) => {
      if (el instanceof Element) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  function scrollToMonth(year: number, month: number) {
    const key = monthKey(year, month);
    const el = monthRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setShowJumper(false);
  }

  function scrollToToday() {
    scrollToMonth(today.getFullYear(), today.getMonth());
  }

  // Years for the jumper
  const jumperYears = useMemo(() => {
    const pastYears = Math.ceil(pastMonths / 12);
    const futureYears = Math.ceil(futureMonths / 12);
    const startYear = today.getFullYear() - pastYears;
    const totalYears = pastYears + futureYears + 1;
    return Array.from({ length: totalYears }, (_, i) => startYear + i);
  }, [pastMonths, futureMonths]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Sticky header */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[15px] font-semibold text-gray-900 tracking-tight">
            {MONTHS[visibleMonth.month]} {visibleMonth.year}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={scrollToToday}
              className="text-[11px] font-medium text-blue-600 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { setShowJumper(!showJumper); setJumperYear(visibleMonth.year); }}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-500 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              {MONTHS_SHORT[visibleMonth.month]} {visibleMonth.year}
              <svg className={`w-3 h-3 transition-transform ${showJumper ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Day-of-week labels */}
        <div className="grid grid-cols-7">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Month/year jumper dropdown */}
      {showJumper && (
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
          {/* Year selector */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setJumperYear(y => y - 1)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 w-14 text-center">{jumperYear}</span>
            <button
              type="button"
              onClick={() => setJumperYear(y => y + 1)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((m, i) => {
              const isCurrent = jumperYear === visibleMonth.year && i === visibleMonth.month;
              const isThisMonth = jumperYear === today.getFullYear() && i === today.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => scrollToMonth(jumperYear, i)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isThisMonth
                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable months */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {months.map(({ year, month: m }) => {
          const key = monthKey(year, m);
          return (
            <div
              key={key}
              data-month={key}
              ref={(el) => {
                if (el) monthRefs.current.set(key, el);
              }}
              className="px-4 pb-2 pt-4"
            >
              {/* Month label */}
              <div className="text-[13px] font-semibold text-gray-800 mb-2 tracking-tight">
                {MONTHS[m]} {year}
              </div>
              <MonthGrid
                year={year}
                month={m}
                today={today}
                selected={selected}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                hovered={hovered}
                onSelect={onSelect}
                onHover={onHover}
                isRange={isRange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar Panel (the container that opens) ───────────────────────────────

interface CalendarPanelProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  fixedPosition?: boolean;
}

function CalendarPanel({ children, open, onClose, containerRef, fixedPosition }: CalendarPanelProps) {
  const [fixedStyle, setFixedStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !fixedPosition || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const panelWidth = 300;
    const panelHeight = 400;
    const gap = 6;

    let top: number | undefined;
    let bottom: number | undefined;
    let left = rect.left;

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= panelHeight + gap) {
      top = rect.bottom + gap;
    } else {
      bottom = window.innerHeight - rect.top + gap;
    }

    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }

    setFixedStyle({ top, bottom, left });
  }, [open, fixedPosition, containerRef]);

  if (!open) return null;

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="sm:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ height: '75vh' }}>
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1 flex-shrink-0" />
          {children}
        </div>
      </div>

      {/* Desktop: dropdown panel */}
      {fixedPosition ? (
        <div
          className="hidden sm:block fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-[300px] h-[400px] overflow-hidden"
          style={fixedStyle}
        >
          {children}
        </div>
      ) : (
        <div className="hidden sm:block absolute z-50 mt-1.5 left-0 bg-white rounded-xl shadow-xl border border-gray-200 w-[300px] h-[400px] overflow-hidden">
          {children}
        </div>
      )}
    </>
  );
}

// ── DateInput (single date) ──────────────────────────────────────────────────

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  pastMonths?: number;
  futureMonths?: number;
  fixedPosition?: boolean;
}

export default function DateInput({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  className = '',
  size = 'md',
  pastMonths = 12,
  futureMonths = 24,
  fixedPosition,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = size === 'sm'
    ? 'py-1.5 px-2.5 text-sm'
    : 'py-2.5 px-3 text-sm';

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Don't close if click is inside the mobile overlay
        const target = e.target as HTMLElement;
        if (target.closest('[data-calendar-overlay]')) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleSelect = useCallback((d: Date) => {
    onChange(toISO(d));
    setOpen(false);
  }, [onChange]);

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 w-full ${sizeClasses} bg-white border border-gray-200 rounded-lg cursor-pointer transition-all hover:border-blue-400 hover:shadow-sm ${open ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
        >
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}
              className="ml-auto p-0.5 text-gray-300 hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
        </button>

        <CalendarPanel open={open} onClose={() => setOpen(false)} containerRef={containerRef} fixedPosition={fixedPosition}>
          <ScrollCalendar
            selected={parseISO(value)}
            onSelect={handleSelect}
            onClose={() => setOpen(false)}
            pastMonths={pastMonths}
            futureMonths={futureMonths}
          />
        </CalendarPanel>
      </div>
    </div>
  );
}

// ── DateRangePicker ──────────────────────────────────────────────────────────

interface DateRangePickerProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  className?: string;
  pastMonths?: number;
  futureMonths?: number;
  fixedPosition?: boolean;
}

export function DateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  startPlaceholder = 'Start',
  endPlaceholder = 'End',
  className = '',
  pastMonths,
  futureMonths,
  fixedPosition,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [hovered, setHovered] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const start = parseISO(startValue);
  const end = parseISO(endValue);

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest('[data-calendar-overlay]')) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleSelect = useCallback((d: Date) => {
    const iso = toISO(d);
    if (picking === 'start') {
      onStartChange(iso);
      if (end && d.getTime() > end.getTime()) {
        onEndChange('');
      }
      setPicking('end');
    } else {
      if (start && d.getTime() < start.getTime()) {
        onStartChange(iso);
        onEndChange(startValue);
      } else {
        onEndChange(iso);
      }
      setOpen(false);
      setPicking('start');
    }
  }, [picking, start, end, startValue, onStartChange, onEndChange]);

  function openPicker(which: 'start' | 'end') {
    setPicking(which);
    setOpen(true);
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onStartChange('');
    onEndChange('');
    setOpen(false);
  }

  const hasValue = startValue || endValue;

  // Range picker tabs that sit above the scroll calendar
  const rangeTabs = (
    <div className="flex-shrink-0 px-4 pt-3 pb-2 bg-white border-b border-gray-100">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setPicking('start')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            picking === 'start'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {startValue ? formatDisplay(startValue) : 'Start Date'}
        </button>
        <button
          type="button"
          onClick={() => setPicking('end')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            picking === 'end'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {endValue ? formatDisplay(endValue) : 'End Date'}
        </button>
      </div>
    </div>
  );

  return (
    <div className={className} ref={containerRef}>
      {(startLabel || endLabel) && (
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel}
        </label>
      )}
      <div className="relative">
        {/* Dual trigger */}
        <div
          className={`flex items-center w-full bg-white border border-gray-200 rounded-lg transition-all hover:border-blue-400 hover:shadow-sm ${open ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
        >
          <button
            type="button"
            onClick={() => openPicker('start')}
            className={`flex items-center gap-2 flex-1 py-2.5 pl-3 pr-2 text-sm rounded-l-lg transition-colors ${picking === 'start' && open ? 'bg-blue-50' : ''}`}
          >
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={startValue ? 'text-gray-900' : 'text-gray-400'}>
              {startValue ? formatDisplay(startValue) : startPlaceholder}
            </span>
          </button>

          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>

          <button
            type="button"
            onClick={() => openPicker('end')}
            className={`flex items-center gap-1 flex-1 py-2.5 pl-2 pr-3 text-sm rounded-r-lg transition-colors ${picking === 'end' && open ? 'bg-blue-50' : ''}`}
          >
            <span className={endValue ? 'text-gray-900' : 'text-gray-400'}>
              {endValue ? formatDisplay(endValue) : endPlaceholder}
            </span>
          </button>

          {hasValue && (
            <span
              role="button"
              onClick={clearAll}
              className="pr-2.5 p-0.5 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
        </div>

        {/* Calendar panel */}
        <CalendarPanel open={open} onClose={() => setOpen(false)} containerRef={containerRef} fixedPosition={fixedPosition}>
          <div className="flex flex-col h-full">
            {rangeTabs}
            <div className="flex-1 min-h-0">
              <ScrollCalendar
                rangeStart={start}
                rangeEnd={end}
                hovered={hovered}
                onSelect={handleSelect}
                onHover={setHovered}
                isRange
                onClose={() => setOpen(false)}
                pastMonths={pastMonths}
                futureMonths={futureMonths}
              />
            </div>
          </div>
        </CalendarPanel>
      </div>
    </div>
  );
}
