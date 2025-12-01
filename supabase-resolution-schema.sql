-- Add resolution columns to contests table
ALTER TABLE contests 
ADD COLUMN IF NOT EXISTS resolution_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add balance to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_winnings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contests_won INTEGER DEFAULT 0;

-- Function to add to user balance
CREATE OR REPLACE FUNCTION add_user_balance(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET 
    balance = COALESCE(balance, 0) + amount,
    total_winnings = COALESCE(total_winnings, 0) + amount,
    contests_won = COALESCE(contests_won, 0) + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_contest_id ON payouts(contest_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications (users can only see their own)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for payouts (users can only see their own)
CREATE POLICY "Users can view own payouts" ON payouts
  FOR SELECT USING (auth.uid() = user_id);
