CREATE TYPE "public"."past_genre" AS ENUM('concert', 'stage', 'other');--> statement-breakpoint
CREATE TYPE "public"."past_source_type" AS ENUM('json_import', 'entry_copy');--> statement-breakpoint
CREATE TABLE "oshi_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"theme_color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "oshi_artists_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "past_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"artist" text,
	"title" text NOT NULL,
	"venue" text,
	"city" text,
	"performance_date" date,
	"start_time" time,
	"seat_info" text,
	"price" integer,
	"genre" "past_genre" NOT NULL,
	"oshi_id" uuid,
	"topic" text,
	"source_type" "past_source_type" NOT NULL,
	"source_image_index" text,
	"source_file" text,
	"source_entry_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "past_attendances" ADD CONSTRAINT "past_attendances_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_attendances" ADD CONSTRAINT "past_attendances_oshi_id_oshi_artists_id_fk" FOREIGN KEY ("oshi_id") REFERENCES "public"."oshi_artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_attendances" ADD CONSTRAINT "past_attendances_source_entry_id_entries_id_fk" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_past_json_import" ON "past_attendances" USING btree ("owner_user_id","source_type","source_image_index");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_past_entry_copy" ON "past_attendances" USING btree ("source_entry_id");