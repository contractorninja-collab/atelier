CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"actor_member_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"table_id" text NOT NULL,
	"row_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_member_id_team_member_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."team_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_row_idx" ON "audit_log" USING btree ("table_id","row_id");