-- Indexes for frequently-queried foreign keys and lookup patterns

-- scores: pool ranking queries filter/aggregate by pool_id
CREATE INDEX IF NOT EXISTS idx_scores_pool_id ON scores(pool_id);

-- scores: recalculateMatchScores deletes and selects by match_id
CREATE INDEX IF NOT EXISTS idx_scores_match_id ON scores(match_id);

-- predictions: score recalculation joins predictions by match_id
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);

-- predictions: backfill and personal lookups filter by user_id
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);

-- pool_members: membership checks (is_in_any_pool, backfill) filter by user_id
CREATE INDEX IF NOT EXISTS idx_pool_members_user_id ON pool_members(user_id);
