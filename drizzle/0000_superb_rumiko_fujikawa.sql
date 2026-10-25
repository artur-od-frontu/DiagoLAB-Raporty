CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"nip" text,
	"email" text,
	"phone" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"finding_key" text NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"nip" text,
	"address" text,
	"phone" text,
	"email" text,
	"certificate_no" text,
	"qualification_scope" text,
	"certificate_valid_until" date,
	"logo_path" text,
	"logo_data" text,
	"logo_mime" text,
	"signature_path" text,
	"instruments" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_id" uuid NOT NULL,
	"report_id" uuid,
	"point_key" text NOT NULL,
	"metric" text NOT NULL,
	"value" double precision,
	"measured_at" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"address" text,
	"type" text,
	"next_inspection_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_id" uuid,
	"number" text NOT NULL,
	"status" text DEFAULT 'SZKIC' NOT NULL,
	"source_file_name" text,
	"source_sha256" text,
	"source_rows" integer,
	"algorithm_version" text,
	"criteria_set" text,
	"data" jsonb,
	"assessment" text,
	"data_verified_confirmed" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'AKTYWNY' NOT NULL,
	"reports_limit" integer,
	"reports_used" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"amount_gr" integer NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"status" text DEFAULT 'NOWA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'NIEZWERYFIKOWANE' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"free_report_used_at" timestamp with time zone,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_decisions" ADD CONSTRAINT "finding_decisions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installer_profiles" ADD CONSTRAINT "installer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_history" ADD CONSTRAINT "measurement_history_object_id_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_history" ADD CONSTRAINT "measurement_history_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_object_id_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drafts_user_idx" ON "drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drafts_kind_idx" ON "drafts" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "fdecisions_report_idx" ON "finding_decisions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "mhist_object_idx" ON "measurement_history" USING btree ("object_id");--> statement-breakpoint
CREATE INDEX "mhist_point_idx" ON "measurement_history" USING btree ("point_key");--> statement-breakpoint
CREATE INDEX "objects_user_idx" ON "objects" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_number_uq" ON "reports" USING btree ("number");--> statement-breakpoint
CREATE INDEX "reports_user_idx" ON "reports" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subs_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tx_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vcodes_user_idx" ON "verification_codes" USING btree ("user_id");