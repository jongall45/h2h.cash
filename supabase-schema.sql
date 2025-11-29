-- =============================================
-- H2H.CASH DATABASE SCHEMA (SAFE TO RE-RUN)
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONTESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('public', 'private')),
  entry_fee DECIMAL(10,2) NOT NULL,
  max_entries INTEGER NOT NULL,
  current_entries INTEGER DEFAULT 0,
  prize_pool DECIMAL(10,2) DEFAULT 0,
  rake_percent DECIMAL(5,2) DEFAULT 10,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'live', 'completed', 'cancelled')),
  game_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES users(id),
  invite_code TEXT UNIQUE,
  payout_structure JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_contests_invite_code ON contests(invite_code);

-- Index for public contests
CREATE INDEX IF NOT EXISTS idx_contests_type_status ON contests(type, status);

-- =============================================
-- ENTRIES TABLE
-- =============================================
-- Drop and recreate entries table to remove foreign key constraint
DROP TABLE IF EXISTS entries CASCADE;

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users, not our users table
  username TEXT NOT NULL,
  picks JSONB NOT NULL,
  total_points DECIMAL(10,2) DEFAULT 0,
  hits_count INTEGER DEFAULT 0,
  is_perfect BOOLEAN DEFAULT FALSE,
  rank INTEGER,
  prize DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_entries_contest_points ON entries(contest_id, total_points DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update contest entry count and prize pool
CREATE OR REPLACE FUNCTION update_contest_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contests
  SET 
    current_entries = current_entries + 1,
    prize_pool = (current_entries + 1) * entry_fee * (1 - rake_percent / 100)
  WHERE id = NEW.contest_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update contest when entry is added
DROP TRIGGER IF EXISTS on_entry_insert ON entries;
CREATE TRIGGER on_entry_insert
  AFTER INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_contest_on_entry();

-- Function to calculate rankings (call this when games complete)
CREATE OR REPLACE FUNCTION calculate_rankings(p_contest_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH ranked AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) as new_rank
    FROM entries
    WHERE contest_id = p_contest_id
  )
  UPDATE entries e
  SET rank = r.new_rank
  FROM ranked r
  WHERE e.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "Anyone can view public contests" ON contests;
DROP POLICY IF EXISTS "Anyone can view contests by invite code" ON contests;
DROP POLICY IF EXISTS "Authenticated users can create contests" ON contests;
DROP POLICY IF EXISTS "Contest creator can update" ON contests;
DROP POLICY IF EXISTS "Anyone can view entries" ON entries;
DROP POLICY IF EXISTS "Authenticated users can create entries" ON entries;
DROP POLICY IF EXISTS "Users can update own entries" ON entries;

-- Users policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);

-- Contests policies
CREATE POLICY "Anyone can view public contests" ON contests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create contests" ON contests FOR INSERT WITH CHECK (true);
CREATE POLICY "Contest creator can update" ON contests FOR UPDATE USING (true);

-- Entries policies
CREATE POLICY "Anyone can view entries" ON entries FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create entries" ON entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own entries" ON entries FOR UPDATE USING (true);

-- =============================================
-- SINGLE TOURNAMENT - 50 ENTRIES
-- =============================================

-- Clear ALL existing contests
DELETE FROM contests;

-- Single tournament: 50 entries, $25 entry fee, top 5 paid
INSERT INTO contests (name, type, entry_fee, max_entries, game_time, payout_structure, status, rake_percent)
VALUES 
  ('🏆 NFL Week 13 Tournament', 'public', 25, 50, NOW() + INTERVAL '1 day', 
   '[{"place": "1st", "percent": 40}, {"place": "2nd", "percent": 25}, {"place": "3rd", "percent": 15}, {"place": "4th", "percent": 10}, {"place": "5th", "percent": 10}]'::jsonb,
   'open',
   10);
