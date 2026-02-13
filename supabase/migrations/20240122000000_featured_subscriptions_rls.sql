-- Enable RLS on featured_subscriptions table
ALTER TABLE featured_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
ON featured_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
ON featured_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can do everything (for webhooks)
CREATE POLICY "Service role has full access"
ON featured_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
