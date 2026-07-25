CREATE TYPE "public"."absence_type" AS ENUM('PTO', 'PublicHoliday', 'Sick', 'Training', 'Parental');--> statement-breakpoint
CREATE TYPE "public"."allocation_confidence" AS ENUM('Confirmed', 'Tentative');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('Proposed', 'Estimated', 'SentToClient', 'Approved', 'Rejected', 'Absorbed');--> statement-breakpoint
CREATE TYPE "public"."health" AS ENUM('Green', 'Amber', 'Red');--> statement-breakpoint
CREATE TYPE "public"."milestone_phase" AS ENUM('Kickoff', 'DiscoveryComplete', 'DesignSignOff', 'BuildPhase', 'Integration', 'UAT', 'GoLive', 'PostLaunchReview');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('NotStarted', 'InProgress', 'Blocked', 'Delivered', 'Accepted', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."portfolio_status" AS ENUM('Idea', 'Discovery', 'Building', 'Live', 'Maintenance', 'Sunset');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('P0', 'P1', 'P2', 'P3');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('NotStarted', 'Kickoff', 'Discovery', 'Design', 'Build', 'UAT', 'Launch', 'Hypercare', 'Closed', 'OnHold', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('ClientDelivery', 'InternalProduct', 'RnD', 'SupportRetainer', 'Migration');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('InternalQA', 'Customer', 'Support', 'Monitoring');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('Risk', 'Issue', 'Dependency', 'ClientBlocker');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('Open', 'Mitigating', 'Closed', 'Accepted');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('Critical', 'Major', 'Minor', 'Trivial');--> statement-breakpoint
CREATE TYPE "public"."sprint_status" AS ENUM('Planned', 'Active', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Backlog', 'Ready', 'InProgress', 'InReview', 'QA', 'Done', 'WontDo');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('Feature', 'Bug', 'Chore', 'Spike', 'Design', 'QA', 'Content', 'Ops');--> statement-breakpoint
CREATE TABLE "absence" (
	"id" text PRIMARY KEY NOT NULL,
	"team_member_id" text NOT NULL,
	"type" "absence_type" DEFAULT 'PTO' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"working_days" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation" (
	"id" text PRIMARY KEY NOT NULL,
	"team_member_id" text NOT NULL,
	"project_id" text,
	"portfolio_product_id" text,
	"week_starting" date NOT NULL,
	"planned_minutes" integer DEFAULT 0 NOT NULL,
	"role_on_engagement" text,
	"billable" boolean DEFAULT true NOT NULL,
	"confidence" "allocation_confidence" DEFAULT 'Confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_request" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"project_id" text NOT NULL,
	"requested_by_id" text,
	"raised_date" date,
	"description" text,
	"impact_minutes" integer DEFAULT 0 NOT NULL,
	"impact_cost_cents" integer DEFAULT 0 NOT NULL,
	"impact_days" integer DEFAULT 0 NOT NULL,
	"status" "change_request_status" DEFAULT 'Proposed' NOT NULL,
	"approved_date" date,
	"upsell_deal_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"project_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"phase" "milestone_phase" DEFAULT 'BuildPhase' NOT NULL,
	"status" "milestone_status" DEFAULT 'NotStarted' NOT NULL,
	"owner_id" text,
	"start_date" date,
	"due_date" date,
	"baseline_due" date,
	"completed_date" date,
	"weight_bps" integer DEFAULT 0 NOT NULL,
	"acceptance_criteria" text,
	"client_sign_off_required" boolean DEFAULT false NOT NULL,
	"signed_off_by_id" text,
	"signed_off_date" date,
	"payment_trigger" boolean DEFAULT false NOT NULL,
	"invoice_amount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_product" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "portfolio_status" DEFAULT 'Idea' NOT NULL,
	"description" text,
	"color" text DEFAULT '#0e9f6e' NOT NULL,
	"owner_id" text,
	"launched_at" date,
	"repo_url" text,
	"production_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_product_name_unique" UNIQUE("name"),
	CONSTRAINT "portfolio_product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"type" "project_type" DEFAULT 'ClientDelivery' NOT NULL,
	"status" "project_status" DEFAULT 'NotStarted' NOT NULL,
	"health" "health" DEFAULT 'Green' NOT NULL,
	"health_note" text,
	"organization_id" text,
	"deal_id" text,
	"portfolio_product_id" text,
	"pm_id" text,
	"start_date" date,
	"target_launch" date,
	"baseline_launch" date,
	"actual_launch" date,
	"budget_minutes" integer DEFAULT 0 NOT NULL,
	"contract_value_cents" integer DEFAULT 0 NOT NULL,
	"scope_summary" text,
	"repo_url" text,
	"staging_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"project_id" text NOT NULL,
	"category" "risk_category" DEFAULT 'Risk' NOT NULL,
	"probability" "risk_level" DEFAULT 'Medium' NOT NULL,
	"impact" "risk_level" DEFAULT 'Medium' NOT NULL,
	"owner_id" text,
	"status" "risk_status" DEFAULT 'Open' NOT NULL,
	"mitigation" text,
	"raised_date" date,
	"target_date" date,
	"resolved_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"status" "sprint_status" DEFAULT 'Planned' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"committed_minutes" integer DEFAULT 0 NOT NULL,
	"retro_notes" text,
	"squad" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"title" text NOT NULL,
	"type" "task_type" DEFAULT 'Feature' NOT NULL,
	"status" "task_status" DEFAULT 'Backlog' NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"priority" "priority" DEFAULT 'P2' NOT NULL,
	"severity" "severity",
	"report_source" "report_source",
	"project_id" text,
	"milestone_id" text,
	"sprint_id" text,
	"portfolio_product_id" text,
	"assignee_id" text,
	"reviewer_id" text,
	"estimate_minutes" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"due_date" date,
	"in_progress_at" timestamp,
	"completed_at" timestamp,
	"acceptance_criteria" text,
	"repro_steps" text,
	"pr_url" text,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"team_member_id" text NOT NULL,
	"worked_on" date NOT NULL,
	"minutes" integer NOT NULL,
	"task_id" text,
	"project_id" text,
	"billable" boolean DEFAULT true NOT NULL,
	"cost_rate_cents" integer DEFAULT 0 NOT NULL,
	"bill_rate_cents" integer DEFAULT 0 NOT NULL,
	"invoiced" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "portfolio_product_id" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "portfolio_product_id" text;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "squad" text;--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_team_member_id_team_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_team_member_id_team_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_portfolio_product_id_portfolio_product_id_fk" FOREIGN KEY ("portfolio_product_id") REFERENCES "public"."portfolio_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_requested_by_id_contact_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_upsell_deal_id_deal_id_fk" FOREIGN KEY ("upsell_deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_signed_off_by_id_contact_id_fk" FOREIGN KEY ("signed_off_by_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_product" ADD CONSTRAINT "portfolio_product_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_portfolio_product_id_portfolio_product_id_fk" FOREIGN KEY ("portfolio_product_id") REFERENCES "public"."portfolio_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_pm_id_team_member_id_fk" FOREIGN KEY ("pm_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk" ADD CONSTRAINT "risk_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_portfolio_product_id_portfolio_product_id_fk" FOREIGN KEY ("portfolio_product_id") REFERENCES "public"."portfolio_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_team_member_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_reviewer_id_team_member_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_team_member_id_team_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_member_idx" ON "absence" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "allocation_member_idx" ON "allocation" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "allocation_week_idx" ON "allocation" USING btree ("week_starting");--> statement-breakpoint
CREATE INDEX "change_request_project_idx" ON "change_request" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "milestone_project_idx" ON "milestone" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_health_idx" ON "project" USING btree ("health");--> statement-breakpoint
CREATE INDEX "project_deal_idx" ON "project" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "project_portfolio_idx" ON "project" USING btree ("portfolio_product_id");--> statement-breakpoint
CREATE INDEX "risk_project_idx" ON "risk" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_sprint_idx" ON "task" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "time_entry_member_idx" ON "time_entry" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "time_entry_project_idx" ON "time_entry" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entry_date_idx" ON "time_entry" USING btree ("worked_on");--> statement-breakpoint
CREATE INDEX "deal_portfolio_idx" ON "deal" USING btree ("portfolio_product_id");