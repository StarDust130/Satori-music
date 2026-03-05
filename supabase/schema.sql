-- ============================================================
-- GymQueue: Supabase SQL Schema
-- Tables: users, queue, votes
-- Views: queue_with_scores
-- Functions: auto-skip on -3 net score
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'unknown',
  client_id TEXT UNIQUE NOT NULL, -- browser fingerprint / localStorage ID
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. QUEUE TABLE
CREATE TABLE IF NOT EXISTS queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  added_by TEXT NOT NULL REFERENCES users(client_id),
  added_by_name TEXT NOT NULL,
  is_played BOOLEAN DEFAULT FALSE,
  is_now_playing BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. VOTES TABLE
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(client_id),
  vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)), -- 1 = upvote, -1 = downvote
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(queue_id, client_id) -- one vote per user per song
);

-- 4. VIEW: Queue with calculated scores
CREATE OR REPLACE VIEW queue_with_scores AS
SELECT
  q.*,
  COALESCE(SUM(v.vote_type), 0) AS net_score,
  COALESCE(COUNT(CASE WHEN v.vote_type = 1 THEN 1 END), 0) AS upvotes,
  COALESCE(COUNT(CASE WHEN v.vote_type = -1 THEN 1 END), 0) AS downvotes
FROM queue q
LEFT JOIN votes v ON v.queue_id = q.id
GROUP BY q.id;

-- 5. FUNCTION: Auto-skip songs with net score <= -3
CREATE OR REPLACE FUNCTION check_auto_skip()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER;
BEGIN
  SELECT COALESCE(SUM(vote_type), 0) INTO score
  FROM votes
  WHERE queue_id = NEW.queue_id;

  IF score <= -3 THEN
    UPDATE queue
    SET is_played = TRUE, played_at = now(), is_now_playing = FALSE
    WHERE id = NEW.queue_id AND is_played = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER: Run auto-skip check after every vote
DROP TRIGGER IF EXISTS trigger_auto_skip ON votes;
CREATE TRIGGER trigger_auto_skip
AFTER INSERT OR UPDATE ON votes
FOR EACH ROW
EXECUTE FUNCTION check_auto_skip();

-- 7. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_queue_is_played ON queue(is_played);
CREATE INDEX IF NOT EXISTS idx_queue_is_now_playing ON queue(is_now_playing);
CREATE INDEX IF NOT EXISTS idx_votes_queue_id ON votes(queue_id);
CREATE INDEX IF NOT EXISTS idx_votes_client_id ON votes(client_id);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_queue_added_by ON queue(added_by);

-- 8. Enable Realtime on queue and votes tables
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- 9. ROW LEVEL SECURITY (basic open policy for gym usage)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (gym is a shared device scenario)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on queue" ON queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on votes" ON votes FOR ALL USING (true) WITH CHECK (true);
