CREATE TABLE "bean_surface" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "bean_surface_code_chk" CHECK ("bean_surface"."code" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "machine_issue" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "machine_issue_code_chk" CHECK ("machine_issue"."code" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "species" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "species_code_chk" CHECK ("species"."code" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"auth_provider" varchar(16),
	"external_subject" varchar(255),
	"locale" varchar(5) DEFAULT 'et' NOT NULL,
	"role" varchar(16) DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "app_user_identity_uq" UNIQUE("auth_provider","external_subject"),
	CONSTRAINT "app_user_provider_chk" CHECK ("app_user"."auth_provider" IN ('GOOGLE')),
	CONSTRAINT "app_user_role_chk" CHECK ("app_user"."role" IN ('USER', 'ADMIN')),
	CONSTRAINT "app_user_locale_chk" CHECK ("app_user"."locale" IN ('et', 'ru')),
	CONSTRAINT "app_user_identity_chk" CHECK (
    ("app_user"."deleted_at" IS NULL AND "app_user"."auth_provider" IS NOT NULL AND "app_user"."external_subject" IS NOT NULL)
    OR ("app_user"."deleted_at" IS NOT NULL AND "app_user"."auth_provider" IS NULL AND "app_user"."external_subject" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brand_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"country_code" char(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_name_uq" UNIQUE("name"),
	CONSTRAINT "brand_slug_uq" UNIQUE("slug"),
	CONSTRAINT "brand_slug_chk" CHECK ("brand"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "brand_country_chk" CHECK ("brand"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "coffee_bean" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coffee_bean_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"brand_id" bigint NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"roast_level" smallint,
	"image_path" varchar(300),
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "coffee_bean_brand_name_uq" UNIQUE("brand_id","name"),
	CONSTRAINT "coffee_bean_slug_uq" UNIQUE("slug"),
	CONSTRAINT "coffee_bean_slug_chk" CHECK ("coffee_bean"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "coffee_bean_roast_level_chk" CHECK ("coffee_bean"."roast_level" BETWEEN 1 AND 5),
	CONSTRAINT "coffee_bean_status_chk" CHECK ("coffee_bean"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "coffee_bean_origin" (
	"coffee_bean_id" bigint NOT NULL,
	"country_code" char(2) NOT NULL,
	CONSTRAINT "coffee_bean_origin_pkey" PRIMARY KEY("coffee_bean_id","country_code"),
	CONSTRAINT "coffee_bean_origin_country_chk" CHECK ("coffee_bean_origin"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "coffee_bean_package" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coffee_bean_package_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"coffee_bean_id" bigint NOT NULL,
	"size_g" integer NOT NULL,
	"gtin" char(14),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_bean_package_gtin_uq" UNIQUE("gtin"),
	CONSTRAINT "coffee_bean_package_size_chk" CHECK ("coffee_bean_package"."size_g" > 0),
	CONSTRAINT "coffee_bean_package_gtin_chk" CHECK ("coffee_bean_package"."gtin" ~ '^[0-9]{14}$')
);
--> statement-breakpoint
CREATE TABLE "coffee_bean_slug_redirect" (
	"old_slug" varchar(200) PRIMARY KEY NOT NULL,
	"coffee_bean_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coffee_bean_species" (
	"coffee_bean_id" bigint NOT NULL,
	"species_code" varchar(32) NOT NULL,
	"percentage" smallint,
	CONSTRAINT "coffee_bean_species_pkey" PRIMARY KEY("coffee_bean_id","species_code"),
	CONSTRAINT "coffee_bean_species_pct_chk" CHECK ("coffee_bean_species"."percentage" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "coffee_bean_translation" (
	"coffee_bean_id" bigint NOT NULL,
	"locale" varchar(5) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_bean_translation_pkey" PRIMARY KEY("coffee_bean_id","locale"),
	CONSTRAINT "coffee_bean_translation_locale_chk" CHECK ("coffee_bean_translation"."locale" IN ('et', 'ru'))
);
--> statement-breakpoint
CREATE TABLE "machine_manufacturer" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "machine_manufacturer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_manufacturer_name_uq" UNIQUE("name"),
	CONSTRAINT "machine_manufacturer_slug_uq" UNIQUE("slug"),
	CONSTRAINT "machine_manufacturer_slug_chk" CHECK ("machine_manufacturer"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "machine_model" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "machine_model_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"manufacturer_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_model_manufacturer_name_uq" UNIQUE("manufacturer_id","name"),
	CONSTRAINT "machine_model_manufacturer_slug_uq" UNIQUE("manufacturer_id","slug"),
	CONSTRAINT "machine_model_slug_chk" CHECK ("machine_model"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "machine_model_kind_chk" CHECK ("machine_model"."kind" IN ('AUTOMATIC', 'PORTAFILTER'))
);
--> statement-breakpoint
CREATE TABLE "user_machine" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_machine_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"machine_model_id" bigint NOT NULL,
	"nickname" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rating_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"coffee_bean_id" bigint NOT NULL,
	"machine_model_id" bigint,
	"score" smallint NOT NULL,
	"perceived_bitterness" smallint,
	"perceived_roast_character" smallint,
	"perceived_crema" smallint,
	"perceived_strength" smallint,
	"bean_surface_code" varchar(32),
	"had_machine_issues" boolean,
	"private_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_user_bean_uq" UNIQUE("user_id","coffee_bean_id"),
	CONSTRAINT "rating_score_chk" CHECK ("rating"."score" BETWEEN 1 AND 5),
	CONSTRAINT "rating_bitterness_chk" CHECK ("rating"."perceived_bitterness" BETWEEN 1 AND 5),
	CONSTRAINT "rating_roast_character_chk" CHECK ("rating"."perceived_roast_character" BETWEEN 1 AND 5),
	CONSTRAINT "rating_crema_chk" CHECK ("rating"."perceived_crema" BETWEEN 1 AND 5),
	CONSTRAINT "rating_strength_chk" CHECK ("rating"."perceived_strength" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "rating_machine_issue" (
	"rating_id" bigint NOT NULL,
	"machine_issue_code" varchar(32) NOT NULL,
	CONSTRAINT "rating_machine_issue_pkey" PRIMARY KEY("rating_id","machine_issue_code")
);
--> statement-breakpoint
CREATE TABLE "user_watched_coffee_bean" (
	"user_id" bigint NOT NULL,
	"coffee_bean_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_watched_coffee_bean_pkey" PRIMARY KEY("user_id","coffee_bean_id")
);
--> statement-breakpoint
CREATE TABLE "suggestion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "suggestion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"suggestion_type" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"user_id" bigint,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_path" varchar(300),
	"resulting_coffee_bean_id" bigint,
	"resulting_machine_model_id" bigint,
	"review_reason" varchar(32),
	"review_note" varchar(500),
	"reviewed_at" timestamp with time zone,
	"result_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_type_chk" CHECK ("suggestion"."suggestion_type" IN ('COFFEE_BEAN', 'MACHINE_MODEL')),
	CONSTRAINT "suggestion_status_chk" CHECK ("suggestion"."status" IN ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE')),
	CONSTRAINT "suggestion_details_chk" CHECK (jsonb_typeof("suggestion"."details") = 'object'),
	CONSTRAINT "suggestion_image_chk" CHECK ("suggestion"."image_path" IS NULL OR "suggestion"."status" = 'PENDING'),
	CONSTRAINT "suggestion_result_chk" CHECK (
    ("suggestion"."suggestion_type" = 'COFFEE_BEAN' AND "suggestion"."resulting_machine_model_id" IS NULL)
    OR ("suggestion"."suggestion_type" = 'MACHINE_MODEL' AND "suggestion"."resulting_coffee_bean_id" IS NULL)),
	CONSTRAINT "suggestion_target_chk" CHECK (
    ("suggestion"."status" IN ('APPROVED', 'DUPLICATE'))
    = ("suggestion"."resulting_coffee_bean_id" IS NOT NULL OR "suggestion"."resulting_machine_model_id" IS NOT NULL)),
	CONSTRAINT "suggestion_reason_chk" CHECK (("suggestion"."status" = 'REJECTED') = ("suggestion"."review_reason" IS NOT NULL)),
	CONSTRAINT "suggestion_reason_code_chk" CHECK ("suggestion"."review_reason" IN ('NOT_WHOLE_BEANS', 'NOT_SOLD_IN_ESTONIA', 'NOT_ENOUGH_INFO', 'OTHER')),
	CONSTRAINT "suggestion_note_chk" CHECK ("suggestion"."review_note" IS NULL OR "suggestion"."status" <> 'PENDING'),
	CONSTRAINT "suggestion_reviewed_chk" CHECK (("suggestion"."status" = 'PENDING') = ("suggestion"."reviewed_at" IS NULL)),
	CONSTRAINT "suggestion_seen_chk" CHECK (
    "suggestion"."result_seen_at" IS NULL OR ("suggestion"."reviewed_at" IS NOT NULL AND "suggestion"."result_seen_at" >= "suggestion"."reviewed_at"))
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"message" varchar(1000) NOT NULL,
	"page_path" varchar(300),
	"user_id" bigint,
	"status" varchar(16) DEFAULT 'NEW' NOT NULL,
	"ip_hmac" char(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_status_chk" CHECK ("feedback"."status" IN ('NEW', 'READ', 'DONE')),
	CONSTRAINT "feedback_message_chk" CHECK (length(btrim("feedback"."message")) > 0)
);
--> statement-breakpoint
ALTER TABLE "coffee_bean" ADD CONSTRAINT "coffee_bean_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_origin" ADD CONSTRAINT "coffee_bean_origin_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_package" ADD CONSTRAINT "coffee_bean_package_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_slug_redirect" ADD CONSTRAINT "coffee_bean_slug_redirect_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_species" ADD CONSTRAINT "coffee_bean_species_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_species" ADD CONSTRAINT "coffee_bean_species_species_code_species_code_fk" FOREIGN KEY ("species_code") REFERENCES "public"."species"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_bean_translation" ADD CONSTRAINT "coffee_bean_translation_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_model" ADD CONSTRAINT "machine_model_manufacturer_id_machine_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."machine_manufacturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_machine" ADD CONSTRAINT "user_machine_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_machine" ADD CONSTRAINT "user_machine_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_bean_surface_code_bean_surface_code_fk" FOREIGN KEY ("bean_surface_code") REFERENCES "public"."bean_surface"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_machine_issue" ADD CONSTRAINT "rating_machine_issue_rating_id_rating_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."rating"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_machine_issue" ADD CONSTRAINT "rating_machine_issue_machine_issue_code_machine_issue_code_fk" FOREIGN KEY ("machine_issue_code") REFERENCES "public"."machine_issue"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watched_coffee_bean" ADD CONSTRAINT "user_watched_coffee_bean_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watched_coffee_bean" ADD CONSTRAINT "user_watched_coffee_bean_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_resulting_coffee_bean_id_coffee_bean_id_fk" FOREIGN KEY ("resulting_coffee_bean_id") REFERENCES "public"."coffee_bean"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_resulting_machine_model_id_machine_model_id_fk" FOREIGN KEY ("resulting_machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coffee_bean_package_coffee_bean_id_idx" ON "coffee_bean_package" USING btree ("coffee_bean_id");--> statement-breakpoint
CREATE INDEX "coffee_bean_slug_redirect_bean_idx" ON "coffee_bean_slug_redirect" USING btree ("coffee_bean_id");--> statement-breakpoint
CREATE INDEX "user_machine_user_id_idx" ON "user_machine" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rating_coffee_bean_id_idx" ON "rating" USING btree ("coffee_bean_id");--> statement-breakpoint
CREATE INDEX "rating_machine_model_id_idx" ON "rating" USING btree ("machine_model_id");--> statement-breakpoint
CREATE INDEX "user_watched_coffee_bean_bean_idx" ON "user_watched_coffee_bean" USING btree ("coffee_bean_id");--> statement-breakpoint
CREATE INDEX "suggestion_user_id_idx" ON "suggestion" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "suggestion_pending_idx" ON "suggestion" USING btree ("created_at") WHERE "suggestion"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "feedback_new_idx" ON "feedback" USING btree ("created_at") WHERE "feedback"."status" = 'NEW';