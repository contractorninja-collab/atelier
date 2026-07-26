ALTER TABLE "time_entry" ADD COLUMN "invoice_id" text;--> statement-breakpoint
CREATE INDEX "time_entry_invoice_idx" ON "time_entry" USING btree ("invoice_id");