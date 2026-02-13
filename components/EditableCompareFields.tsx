'use client';

import { ComparisonCustomization, DayTimeSelection } from '@/types/comparison';
import { HoursPerDay } from '@/types/database';

interface EditableCompareFieldsProps {
  customization: ComparisonCustomization;
  operatingDays: string[];
  hoursPerDay: HoursPerDay;
  priceUnit: string | null;
  onChange: (customization: Partial<ComparisonCustomization>) => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

export default function EditableCompareFields({
  customization,
  operatingDays,
  hoursPerDay,
  priceUnit,
  onChange,
}: EditableCompareFieldsProps) {
  const selectedDays = customization.selectedDays || [];

  const handleDayToggle = (day: string) => {
    const isCurrentlySelected = selectedDays.some(d => d.day === day);

    if (isCurrentlySelected) {
      onChange({
        selectedDays: selectedDays.filter(d => d.day !== day),
      });
    } else {
      const newDay: DayTimeSelection = {
        day,
        time: '17:00',
      };
      onChange({
        selectedDays: [...selectedDays, newDay],
      });
    }
  };

  const handleTimeChange = (day: string, time: string) => {
    onChange({
      selectedDays: selectedDays.map(d =>
        d.day === day ? { ...d, time } : d
      ),
    });
  };

  const timesPerWeek = selectedDays.length;

  return (
    <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <div>
        <h4 className="text-sm font-semibold text-yellow-800">Your Preferences</h4>
        <p className="text-xs text-yellow-700 mt-1">
          Enter your cost and schedule to get a monthly estimate.
        </p>
      </div>

      {/* Cost per Session */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Cost per Session</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={customization.costPerSession ?? ''}
            onChange={(e) => onChange({
              costPerSession: e.target.value ? parseFloat(e.target.value) : null
            })}
            className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="0.00"
          />
          {priceUnit && <span className="text-xs text-gray-500">{priceUnit}</span>}
        </div>
      </div>

      {/* Day Selection - Multiple choice */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          Which days?
          {operatingDays.length > 0 && (
            <span className="text-gray-400 ml-1">(green = program operates)</span>
          )}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const isOperatingDay = operatingDays.includes(key);
            const isSelected = selectedDays.some(d => d.day === key);

            return (
              <button
                key={key}
                onClick={() => handleDayToggle(key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : isOperatingDay
                      ? 'bg-green-100 border border-green-300 text-green-800 hover:bg-green-200'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selection for each selected day */}
      {selectedDays.length > 0 && (
        <div>
          <label className="block text-xs text-gray-600 mb-2">What time?</label>
          <div className="space-y-2">
            {DAYS_OF_WEEK.filter(d => selectedDays.some(s => s.day === d.key)).map(({ key, label }) => {
              const daySelection = selectedDays.find(d => d.day === key);
              const isOperatingDay = operatingDays.includes(key);

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className={`w-12 text-sm font-medium ${isOperatingDay ? 'text-green-700' : 'text-gray-700'}`}>
                    {label}
                  </span>
                  <input
                    type="time"
                    value={daySelection?.time || '17:00'}
                    onChange={(e) => handleTimeChange(key, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                  {!isOperatingDay && operatingDays.length > 0 && (
                    <span className="text-xs text-amber-600">May not operate</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Cost Estimate */}
      {customization.costPerSession && timesPerWeek > 0 && (() => {
        const weeklyTotal = customization.costPerSession * timesPerWeek;
        const monthlyLow = weeklyTotal * 4;
        const monthlyHigh = weeklyTotal * 5;
        return (
          <div className="pt-3 border-t border-yellow-300">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Est. Monthly:</span>
              <span className="text-lg font-bold text-gray-900">
                ${monthlyLow.toFixed(0)} - ${monthlyHigh.toFixed(0)}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
