'use client';

import type { HoursPerDay } from '@/types/database';

interface HoursPerDayInputProps {
  selectedDays: string[];
  hours: HoursPerDay;
  onChange: (hours: HoursPerDay) => void;
  disabled?: boolean;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export default function HoursPerDayInput({
  selectedDays,
  hours,
  onChange,
  disabled = false,
}: HoursPerDayInputProps) {
  // Sort selected days in proper order
  const sortedDays = DAYS_ORDER.filter((day) => selectedDays.includes(day));

  const handleTimeChange = (day: string, field: 'open' | 'close', value: string) => {
    const currentHours = hours[day] || { open: '09:00', close: '17:00' };
    onChange({
      ...hours,
      [day]: {
        ...currentHours,
        [field]: value,
      },
    });
  };

  if (sortedDays.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Select operating days above to set hours
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Hours Per Day
      </label>
      <div className="space-y-2">
        {sortedDays.map((day) => {
          const dayHours = hours[day] || { open: '09:00', close: '17:00' };
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="w-12 text-sm font-medium text-gray-600">
                {DAY_ABBREVIATIONS[day]}
              </span>
              <input
                type="time"
                value={dayHours.open}
                onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                disabled={disabled}
                className="input-field text-sm py-1 px-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                value={dayHours.close}
                onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                disabled={disabled}
                className="input-field text-sm py-1 px-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
