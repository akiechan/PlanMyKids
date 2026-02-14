-- Fix: Allow reading all programs, not just active ones.
-- The active-only filter was breaking planner JOINs (saved programs
-- referencing non-active programs would return null data).
-- Application-layer code already filters by status = 'active' for public views.

DROP POLICY IF EXISTS "Anyone can read active programs" ON programs;

CREATE POLICY "Anyone can read programs" ON programs
  FOR SELECT USING (true);
