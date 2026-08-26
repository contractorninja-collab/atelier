CREATE TYPE "public"."eos_issue_status" AS ENUM('Open', 'Solved', 'Dropped');--> statement-breakpoint
CREATE TYPE "public"."measurable_direction" AS ENUM('AtLeast', 'AtMost');--> statement-breakpoint
CREATE TYPE "public"."measurable_unit" AS ENUM('Money', 'Percent', 'Count');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('Scheduled', 'InProgress', 'Concluded');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('L10', 'Quarterly', 'Annual');--> statement-breakpoint
CREATE TYPE "public"."rock_scope" AS ENUM('Company', 'Individual');--> statement-breakpoint
CREATE TYPE "public"."rock_status" AS ENUM('OnTrack', 'OffTrack', 'Done', 'Dropped');--> statement-breakpoint
CREATE TABLE "eos_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"status" "eos_issue_status" DEFAULT 'Open' NOT NULL,
	"owner_id" text,
	"solved_in_meeting_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eos_todo" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"owner_id" text NOT NULL,
	"due_date" date NOT NULL,
	"meeting_id" text,
	"done" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurable" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"unit" "measurable_unit" DEFAULT 'Count' NOT NULL,
	"goal_value" integer DEFAULT 0 NOT NULL,
	"direction" "measurable_direction" DEFAULT 'AtLeast' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "measurable_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"type" "meeting_type" DEFAULT 'L10' NOT NULL,
	"held_on" date NOT NULL,
	"status" "meeting_status" DEFAULT 'Scheduled' NOT NULL,
	"owner_id" text,
	"duration_minutes" integer,
	"started_at" timestamp,
	"concluded_at" timestamp,
	"rating" integer,
	"headlines" text,
	"cascading_messages" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rock" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"quarter" text NOT NULL,
	"scope" "rock_scope" DEFAULT 'Individual' NOT NULL,
	"status" "rock_status" DEFAULT 'OnTrack' NOT NULL,
	"owner_id" text NOT NULL,
	"due_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorecard_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"measurable_id" text NOT NULL,
	"week_starting" date NOT NULL,
	"value" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eos_issue" ADD CONSTRAINT "eos_issue_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eos_issue" ADD CONSTRAINT "eos_issue_solved_in_meeting_id_meeting_id_fk" FOREIGN KEY ("solved_in_meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eos_todo" ADD CONSTRAINT "eos_todo_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eos_todo" ADD CONSTRAINT "eos_todo_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurable" ADD CONSTRAINT "measurable_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rock" ADD CONSTRAINT "rock_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_entry" ADD CONSTRAINT "scorecard_entry_measurable_id_measurable_id_fk" FOREIGN KEY ("measurable_id") REFERENCES "public"."measurable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eos_issue_status_idx" ON "eos_issue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "eos_todo_owner_idx" ON "eos_todo" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "eos_todo_due_idx" ON "eos_todo" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "meeting_held_idx" ON "meeting" USING btree ("held_on");--> statement-breakpoint
CREATE INDEX "meeting_status_idx" ON "meeting" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rock_quarter_idx" ON "rock" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX "rock_owner_idx" ON "rock" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_entry_week_starting_key" ON "scorecard_entry" USING btree ("measurable_id","week_starting");--> statement-breakpoint
CREATE INDEX "scorecard_entry_measurable_idx" ON "scorecard_entry" USING btree ("measurable_id");--> statement-breakpoint
CREATE INDEX "scorecard_entry_week_idx" ON "scorecard_entry" USING btree ("week_starting");