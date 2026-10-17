-- Vocabulary rows. A migration rather than the seed, because production needs them too.
-- The codes are the i18n keys; their labels live in the locale files.
INSERT INTO species (code, sort_order) VALUES
    ('ARABICA', 1), ('ROBUSTA', 2), ('LIBERICA', 3), ('EXCELSA', 4);
--> statement-breakpoint
INSERT INTO bean_surface (code, sort_order) VALUES
    ('DRY', 1), ('SLIGHTLY_OILY', 2), ('OILY', 3);
--> statement-breakpoint
INSERT INTO machine_issue (code, sort_order) VALUES
    ('BEANS_STICK_IN_HOPPER', 1),
    ('GRINDER_STRUGGLED',     2),
    ('GRINDER_JAMMED',        3),
    ('FREQUENT_CLEANING',     4),
    ('OTHER',                 5);
