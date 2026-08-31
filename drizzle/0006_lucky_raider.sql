CREATE TABLE "application_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"first_choice_performance_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "application_group_id" uuid;--> statement-breakpoint
ALTER TABLE "application_groups" ADD CONSTRAINT "application_groups_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_groups" ADD CONSTRAINT "application_groups_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_groups" ADD CONSTRAINT "application_groups_first_choice_performance_id_performances_id_fk" FOREIGN KEY ("first_choice_performance_id") REFERENCES "public"."performances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_application_group_id_application_groups_id_fk" FOREIGN KEY ("application_group_id") REFERENCES "public"."application_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_application_group_idx" ON "entries" USING btree ("application_group_id");