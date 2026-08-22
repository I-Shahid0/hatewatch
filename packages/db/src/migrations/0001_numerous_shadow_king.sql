ALTER TABLE "classification" DROP CONSTRAINT "classification_ai_run_id_ai_run_id_fk";
--> statement-breakpoint
ALTER TABLE "pattern" DROP CONSTRAINT "pattern_ai_run_id_ai_run_id_fk";
--> statement-breakpoint
ALTER TABLE "classification" ADD CONSTRAINT "classification_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern" ADD CONSTRAINT "pattern_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;