-- Database objects drizzle-kit doesn't generate: extensions, triggers, views and functions.
-- Hand-written (drizzle-kit generate --custom). No BEGIN/COMMIT: the migrator runs all
-- pending migrations in one transaction. Once this has run anywhere, change it only
-- through a new migration.

-- Both ship with Postgres and are trusted, so the database owner can create them without
-- superuser rights. They power typo-tolerant search (trigram similarity, accent folding).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

-- updated_at is set here rather than in the app, so edits made outside the app keep it right.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER app_user_updated_at                BEFORE UPDATE ON app_user                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER brand_updated_at                   BEFORE UPDATE ON brand                   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER coffee_bean_updated_at             BEFORE UPDATE ON coffee_bean             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER coffee_bean_translation_updated_at BEFORE UPDATE ON coffee_bean_translation FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER coffee_bean_package_updated_at     BEFORE UPDATE ON coffee_bean_package     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER machine_manufacturer_updated_at    BEFORE UPDATE ON machine_manufacturer    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER machine_model_updated_at           BEFORE UPDATE ON machine_model           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER user_machine_updated_at            BEFORE UPDATE ON user_machine            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER rating_updated_at                  BEFORE UPDATE ON rating                  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER suggestion_updated_at              BEFORE UPDATE ON suggestion              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER feedback_updated_at                BEFORE UPDATE ON feedback                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Slug changes never break public URLs.
--   * A slug in live use always wins: taking one removes its redirect.
--   * Renaming keeps the old slug as a redirect, but only if the old URL was ever
--     public. Draft slugs were never published, so they get none.
CREATE FUNCTION coffee_bean_track_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM coffee_bean_slug_redirect WHERE old_slug = NEW.slug;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.slug <> OLD.slug AND OLD.status <> 'DRAFT' THEN
            INSERT INTO coffee_bean_slug_redirect (old_slug, coffee_bean_id)
            VALUES (OLD.slug, NEW.id)
            ON CONFLICT (old_slug) DO UPDATE
                SET coffee_bean_id = EXCLUDED.coffee_bean_id,
                    created_at     = now();
        END IF;
    END IF;

    RETURN NULL;   -- AFTER trigger: the return value is ignored
END;
$$;
--> statement-breakpoint
CREATE TRIGGER coffee_bean_slug_redirect_sync
    AFTER INSERT OR UPDATE OF slug ON coffee_bean
    FOR EACH ROW EXECUTE FUNCTION coffee_bean_track_slug();
--> statement-breakpoint

-- Ranking and histogram. Shrunk mean = (C*m + sum) / (C + n): C is the pseudo-count every
-- coffee starts with, m the global mean of all ratings. A coffee with 2 ratings is pulled
-- toward m; one with 40 barely moves. Pages show raw_mean; the ranked list sorts by
-- shrunk_mean. Declared in the Drizzle schema with .existing().
CREATE VIEW coffee_bean_rating_summary AS
WITH prior AS (
    SELECT 5::numeric                       AS weight,
           COALESCE(avg(score), 3)::numeric AS mean
    FROM rating
)
SELECT b.id                                                   AS coffee_bean_id,
       b.status,
       count(r.id)                                            AS rating_count,
       round(avg(r.score), 2)                                 AS raw_mean,
       round((p.weight * p.mean + COALESCE(sum(r.score), 0))
             / (p.weight + count(r.id)), 3)                   AS shrunk_mean,
       count(*) FILTER (WHERE r.score = 1)                    AS score_1_count,
       count(*) FILTER (WHERE r.score = 2)                    AS score_2_count,
       count(*) FILTER (WHERE r.score = 3)                    AS score_3_count,
       count(*) FILTER (WHERE r.score = 4)                    AS score_4_count,
       count(*) FILTER (WHERE r.score = 5)                    AS score_5_count
FROM coffee_bean b
CROSS JOIN prior p
LEFT JOIN rating r ON r.coffee_bean_id = b.id
WHERE b.status <> 'DRAFT'
GROUP BY b.id, p.weight, p.mean;
--> statement-breakpoint

-- "6 of 14 Philips owners reported issues": the denominator counts only those who answered.
-- The UI shows AUTOMATIC rows per manufacturer and sums PORTAFILTER rows into one group.
-- machine_kind and manufacturer_id NULL = rated without naming a machine.
CREATE VIEW coffee_bean_machine_issue_summary AS
SELECT r.coffee_bean_id,
       mm.kind                                                  AS machine_kind,
       mm.manufacturer_id,
       count(*) FILTER (WHERE r.had_machine_issues IS NOT NULL) AS answered_count,
       count(*) FILTER (WHERE r.had_machine_issues)             AS with_issues_count
FROM rating r
LEFT JOIN machine_model mm ON mm.id = r.machine_model_id
GROUP BY r.coffee_bean_id, mm.kind, mm.manufacturer_id;
--> statement-breakpoint

-- Right to be forgotten: ratings survive, the person does not. Returns true if an active
-- user was anonymised, false if there was nothing to do. Sessions already issued are
-- ended by the app's session check, which drops the session once deleted_at is set.
CREATE FUNCTION anonymise_user(p_user_id bigint) RETURNS boolean
LANGUAGE sql AS $$
    DELETE FROM user_watched_coffee_bean WHERE user_id = p_user_id;
    DELETE FROM user_machine             WHERE user_id = p_user_id;
    UPDATE rating     SET private_note = NULL WHERE user_id = p_user_id;
    UPDATE suggestion SET user_id      = NULL WHERE user_id = p_user_id;
    UPDATE feedback   SET user_id      = NULL WHERE user_id = p_user_id;
    WITH anonymised AS (
        UPDATE app_user
           SET auth_provider    = NULL,
               external_subject = NULL,
               deleted_at       = now()
         WHERE id = p_user_id
           AND deleted_at IS NULL
        RETURNING id
    )
    SELECT EXISTS (SELECT FROM anonymised);
$$;
