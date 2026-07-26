CREATE TYPE "public"."invoice_status" AS ENUM('Draft', 'Sent', 'Void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('Transfer', 'Card', 'DirectDebit', 'Cash', 'Other');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('Active', 'Paused', 'Cancelled');--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"number" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"subscription_id" text,
	"milestone_id" text,
	"status" "invoice_status" DEFAULT 'Draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"owner_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"invoice_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" DEFAULT 'Transfer' NOT NULL,
	"reference" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"organization_id" text NOT NULL,
	"portfolio_product_id" text,
	"deal_id" text,
	"status" "subscription_status" DEFAULT 'Active' NOT NULL,
	"start_date" date NOT NULL,
	"term_months" integer DEFAULT 12 NOT NULL,
	"renews_on" date NOT NULL,
	"ended_on" date,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"billing" "billing_freq" DEFAULT 'Monthly' NOT NULL,
	"cancel_reason" text,
	"notes" text,
	"owner_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_portfolio_product_id_portfolio_product_id_fk" FOREIGN KEY ("portfolio_product_id") REFERENCES "public"."portfolio_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_org_idx" ON "invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoice_due_idx" ON "invoice" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_invoice_idx" ON "payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_renews_idx" ON "subscription" USING btree ("renews_on");