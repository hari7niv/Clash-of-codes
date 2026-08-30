CREATE INDEX IF NOT EXISTS idx_user_quests_user_date ON user_quests(user_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_friendships_user_friend ON friendships(user_id, friend_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quests_title_lower ON quest_definitions(lower(title));

