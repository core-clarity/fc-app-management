CREATE TYPE "public"."companion_timing" AS ENUM('at_entry', 'before_show');--> statement-breakpoint
CREATE TYPE "public"."companion_type" AS ENUM('fc_member', 'general_email', 'none');--> statement-breakpoint
CREATE TYPE "public"."id_verification" AS ENUM('none', 'face_auth', 'other');--> statement-breakpoint
CREATE TYPE "public"."lottery_result" AS ENUM('pending', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_required', 'pending', 'completed');--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"companion_type" "companion_type" DEFAULT 'fc_member' NOT NULL,
	"companion_member_id" uuid,
	"companion_email" text,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"lottery_result" "lottery_result" DEFAULT 'pending' NOT NULL,
	"result_notified_at" timestamp,
	"payment_status" "payment_status" DEFAULT 'not_required' NOT NULL,
	"paid_at" timestamp,
	"seat_info" text,
	"ticket_image_url" text
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"label" text NOT NULL,
	"name" text NOT NULL,
	"fc_member_number" text,
	"address_group" text,
	"can_pass_id_verification" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"symbol" text,
	"theme_color" text
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_id" uuid NOT NULL,
	"venue" text NOT NULL,
	"performance_date" date NOT NULL,
	"start_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"companion_timing" "companion_timing" NOT NULL,
	"id_verification" "id_verification" DEFAULT 'none' NOT NULL,
	"allows_general_companion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_companion_member_id_members_id_fk" FOREIGN KEY ("companion_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_entry" ON "entries" USING btree ("performance_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_performance" ON "performances" USING btree ("production_id","performance_date","start_time","venue");