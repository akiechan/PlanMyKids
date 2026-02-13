'use client';

interface GridSizeControlProps {
  columns: number;
  onIncrement: () => void;
  onDecrement: () => void;
  canIncrement: boolean;
  canDecrement: boolean;
}

export default function GridSizeControl({
  columns,
  onIncrement,
  onDecrement,
  canIncrement,
  canDecrement,
}: GridSizeControlProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDecrement}
        disabled={!canDecrement}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
        title="Fewer per row"
      >
        −
      </button>
      <span className="text-xs text-gray-400 w-4 text-center">{columns}</span>
      <button
        onClick={onIncrement}
        disabled={!canIncrement}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
        title="More per row"
      >
        +
      </button>
    </div>
  );
}
