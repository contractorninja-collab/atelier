CREATE TYPE "public"."activity_outcome" AS ENUM('Connected', 'NoAnswer', 'Positive', 'Neutral', 'Negative', 'NextStepSet');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('Call', 'Email', 'Meeting', 'Demo', 'Note', 'CheckIn', 'QBR', 'Onboarding');--> statement-breakpoint
CREATE TYPE "public"."billing_freq" AS ENUM('OneOff', 'Monthly', 'Annual', 'UsageBased');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('Active', 'LeftCompany', 'Unresponsive', 'Bounced', 'DoNotContact');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('EUR', 'PLN', 'USD', 'GBP');--> statement-breakpoint
CREATE TYPE "public"."deal_motion" AS ENUM('NewBusiness', 'Expansion', 'Upsell', 'CrossSell', 'Renewal', 'WinBack');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('Qualifying', 'Discovery', 'SolutionFit', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost', 'Nurture');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('Subscription', 'Project', 'Hybrid', 'Retainer');--> statement-breakpoint
CREATE TYPE "public"."department" AS ENUM('Sales', 'Delivery', 'Engineering', 'Ops');--> statement-breakpoint
CREATE TYPE "public"."forecast_category" AS ENUM('Pipeline', 'BestCase', 'Commit', 'ClosedWon', 'ClosedLost');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_stage" AS ENUM('Lead', 'MQL', 'SQL', 'Opportunity', 'Customer', 'Churned', 'Disqualified');--> statement-breakpoint
CREATE TYPE "public"."loss_reason" AS ENUM('Price', 'Timing', 'NoBudget', 'LostToCompetitor', 'NoDecision', 'MissingFeature', 'BadFit', 'Unresponsive');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('Founder', 'AE', 'SDR', 'CSM', 'PartnerManager', 'PM', 'Designer', 'Engineer', 'QA', 'Ops');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('Active', 'OnLeave', 'Inactive');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('Prospect', 'Customer', 'Partner', 'Reseller', 'Vendor');--> statement-breakpoint
CREATE TYPE "public"."persona" AS ENUM('Champion', 'EconomicBuyer', 'TechnicalEvaluator', 'EndUser', 'Blocker', 'Introducer');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('SaaSPlan', 'Service', 'AddOn', 'OneOff', 'Retainer');--> statement-breakpoint
CREATE TYPE "public"."segment" AS ENUM('Micro', 'SMB', 'MidMarket', 'Enterprise');--> statement-breakpoint
CREATE TYPE "public"."source_category" AS ENUM('Outbound', 'Inbound', 'Referral', 'Partner', 'Paid', 'Event', 'Content', 'Organic', 'AppStore');--> statement-breakpoint
CREATE TYPE "public"."target_metric" AS ENUM('NewBusinessTCV', 'NetNewMRR', 'ClosedWonCount', 'BillableUtilization', 'GrossMargin');--> statement-breakpoint
CREATE TYPE "public"."target_scope" AS ENUM('Company', 'Team', 'Individual');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"subject" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"direction" text,
	"duration_minutes" integer,
	"outcome" "activity_outcome",
	"next_step" text,
	"next_step_due" date,
	"notes" text,
	"owner_id" text,
	"organization_id" text,
	"contact_id" text,
	"deal_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text,
	"persona" "persona",
	"status" "contact_status" DEFAULT 'Active' NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"language" text,
	"linkedin" text,
	"notes" text,
	"organization_id" text NOT NULL,
	"owner_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "deal_contact" (
	"deal_id" text NOT NULL,
	"contact_id" text NOT NULL,
	CONSTRAINT "deal_contact_deal_id_contact_id_pk" PRIMARY KEY("deal_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "deal_line_item" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_bps" integer DEFAULT 0 NOT NULL,
	"billing" "billing_freq" NOT NULL,
	"estimated_delivery_hours" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"from_stage" "deal_stage",
	"to_stage" "deal_stage" NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"days_in_previous_stage" integer,
	"changed_by_id" text
);
--> statement-breakpoint
CREATE TABLE "deal" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"stage" "deal_stage" DEFAULT 'Qualifying' NOT NULL,
	"stage_entered_at" timestamp DEFAULT now() NOT NULL,
	"motion" "deal_motion" DEFAULT 'NewBusiness' NOT NULL,
	"type" "deal_type" DEFAULT 'Subscription' NOT NULL,
	"forecast" "forecast_category" DEFAULT 'Pipeline' NOT NULL,
	"currency" "currency" DEFAULT 'EUR' NOT NULL,
	"contract_months" integer DEFAULT 12 NOT NULL,
	"probability_override_bps" integer,
	"expected_close_date" date,
	"actual_close_date" date,
	"next_step" text,
	"next_step_date" date,
	"champion_identified" boolean DEFAULT false NOT NULL,
	"economic_buyer_identified" boolean DEFAULT false NOT NULL,
	"pain_documented" boolean DEFAULT false NOT NULL,
	"decision_process_documented" boolean DEFAULT false NOT NULL,
	"loss_reason" "loss_reason",
	"loss_notes" text,
	"competitors" text[] DEFAULT '{}' NOT NULL,
	"proposal_url" text,
	"contract_url" text,
	"notes" text,
	"organization_id" text NOT NULL,
	"primary_contact_id" text,
	"owner_id" text,
	"source_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"domain" text NOT NULL,
	"types" "org_type"[] DEFAULT '{"Prospect"}' NOT NULL,
	"lifecycle" "lifecycle_stage" DEFAULT 'Lead' NOT NULL,
	"segment" "segment",
	"industry" text,
	"country" text,
	"city" text,
	"employee_count" integer,
	"website" text,
	"linkedin" text,
	"vat_id" text,
	"notes" text,
	"owner_id" text,
	"source_id" text,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"type" "product_type" NOT NULL,
	"list_price_cents" integer NOT NULL,
	"billing" "billing_freq" NOT NULL,
	"unit" text,
	"cost_to_serve_cents" integer,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "source_category" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"monthly_cost_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "target" (
	"id" text PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"metric" "target_metric" NOT NULL,
	"scope" "target_scope" DEFAULT 'Company' NOT NULL,
	"value" integer NOT NULL,
	"team_member_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"department" "department" NOT NULL,
	"status" "member_status" DEFAULT 'Active' NOT NULL,
	"weekly_capacity_hours" integer DEFAULT 40 NOT NULL,
	"cost_rate_cents" integer,
	"bill_rate_cents" integer,
	"timezone" text DEFAULT 'Europe/Warsaw',
	"start_date" date,
	"end_date" date,
	"user_id" text,
	"manager_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contact" ADD CONSTRAINT "deal_contact_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contact" ADD CONSTRAINT "deal_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_item" ADD CONSTRAINT "deal_line_item_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_item" ADD CONSTRAINT "deal_line_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_changed_by_id_team_member_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_primary_contact_id_contact_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_id_team_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target" ADD CONSTRAINT "target_team_member_id_team_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_occurred_idx" ON "activity" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "activity_deal_idx" ON "activity" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "contact_organization_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "line_item_deal_idx" ON "deal_line_item" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "stage_history_deal_idx" ON "deal_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "stage_history_changed_idx" ON "deal_stage_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "deal_stage_idx" ON "deal" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deal_owner_idx" ON "deal" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deal_close_idx" ON "deal" USING btree ("expected_close_date");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_domain_key" ON "organization" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "organization_lifecycle_idx" ON "organization" USING btree ("lifecycle");--> statement-breakpoint
CREATE INDEX "organization_owner_idx" ON "organization" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "target_unique" ON "target" USING btree ("period","metric","scope","team_member_id");--> statement-breakpoint
CREATE INDEX "team_member_department_idx" ON "team_member" USING btree ("department");