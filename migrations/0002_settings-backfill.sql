-- Every person has one settings row with the default ladder and colour counter.
-- New users get theirs on first login; this gives one to people who signed in before phase 2.
INSERT INTO `settings` (`user_id`)
SELECT `id` FROM `users`
WHERE `id` NOT IN (SELECT `user_id` FROM `settings`);
