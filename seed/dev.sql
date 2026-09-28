-- Local development data. Phase 0 only needs the dev user (DEV_USER_EMAIL in .dev.vars);
-- phase 2 replaces this with sections and items like the mockups.
INSERT INTO users (email) VALUES ('dev@mnemos.local') ON CONFLICT (email) DO NOTHING;
