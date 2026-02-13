-- Create table for program edit requests
CREATE TABLE IF NOT EXISTS program_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,

  -- Edit request status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Edited program data (stores full program data as submitted by user)
  edited_data JSONB NOT NULL,

  -- Submitter information
  submitted_by_email TEXT,
  submitted_by_name TEXT,
  edit_notes TEXT, -- User can explain what they changed and why

  -- Admin review
  reviewed_by TEXT, -- Admin who reviewed
  review_notes TEXT, -- Admin notes
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_edit_requests_program_id ON program_edit_requests(program_id);
CREATE INDEX idx_edit_requests_status ON program_edit_requests(status);
CREATE INDEX idx_edit_requests_created_at ON program_edit_requests(created_at DESC);

-- Comments
COMMENT ON TABLE program_edit_requests IS 'User-submitted edit requests for programs that require admin review';
COMMENT ON COLUMN program_edit_requests.edited_data IS 'Full program data as edited by user, stored as JSONB for flexibility';
COMMENT ON COLUMN program_edit_requests.status IS 'pending: awaiting review, approved: applied to program, rejected: declined by admin';
