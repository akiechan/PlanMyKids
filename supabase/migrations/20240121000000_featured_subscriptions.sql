-- Add is_featured column to programs if not exists
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Create featured_subscriptions table
CREATE TABLE IF NOT EXISTS featured_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,

    -- Stripe data
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT NOT NULL,

    -- Subscription details
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free_trial', 'weekly', 'monthly')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'expired'
    )),

    -- Dates
    trial_start DATE,
    trial_end DATE,
    current_period_start DATE,
    current_period_end DATE,
    canceled_at TIMESTAMP WITH TIME ZONE,

    -- Contact info
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    program_logo_url TEXT,

    -- Program data for new programs (before they're created in programs table)
    program_data JSONB,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_featured_subscriptions_program_id ON featured_subscriptions(program_id);
CREATE INDEX IF NOT EXISTS idx_featured_subscriptions_user_id ON featured_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_featured_subscriptions_stripe_subscription_id ON featured_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_featured_subscriptions_status ON featured_subscriptions(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_featured_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_featured_subscriptions_updated_at ON featured_subscriptions;
CREATE TRIGGER trigger_update_featured_subscriptions_updated_at
BEFORE UPDATE ON featured_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_featured_subscriptions_updated_at();

-- Function to sync is_featured status on programs table
CREATE OR REPLACE FUNCTION sync_program_featured_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip if no program_id
    IF NEW.program_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- When subscription becomes active or trialing, mark program as featured
    IF NEW.status IN ('active', 'trialing') AND
       (OLD IS NULL OR OLD.status IS NULL OR OLD.status NOT IN ('active', 'trialing')) THEN
        UPDATE programs SET is_featured = TRUE WHERE id = NEW.program_id;
    END IF;

    -- When subscription ends, check if any other active subscriptions exist
    IF NEW.status IN ('canceled', 'expired', 'past_due') AND
       OLD.status IN ('active', 'trialing') THEN
        UPDATE programs SET is_featured = (
            SELECT EXISTS(
                SELECT 1 FROM featured_subscriptions
                WHERE program_id = NEW.program_id
                AND status IN ('active', 'trialing')
                AND id != NEW.id
            )
        ) WHERE id = NEW.program_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_featured_status ON featured_subscriptions;
CREATE TRIGGER trigger_sync_featured_status
AFTER INSERT OR UPDATE OF status ON featured_subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_program_featured_status();
