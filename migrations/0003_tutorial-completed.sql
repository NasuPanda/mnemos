-- When a person finished or skipped the first-run tutorial. No backfill: everyone, including
-- people who signed up before the tutorial, starts null and sees it once.
ALTER TABLE `settings` ADD `tutorial_completed_at` text;