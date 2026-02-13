-- Add sort_order column to planner_saved_programs for drag-and-drop reordering
ALTER TABLE planner_saved_programs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill: order by saved_at DESC within each user+status group
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY saved_at DESC) - 1 AS new_order
  FROM planner_saved_programs
)
UPDATE planner_saved_programs SET sort_order = ranked.new_order FROM ranked WHERE planner_saved_programs.id = ranked.id;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_planner_saved_programs_sort_order ON planner_saved_programs(user_id, status, sort_order);
