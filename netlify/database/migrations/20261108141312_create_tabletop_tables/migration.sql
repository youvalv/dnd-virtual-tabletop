CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"invite_code" text NOT NULL UNIQUE,
	"status" text DEFAULT 'idle' NOT NULL,
	"session_number" integer DEFAULT 0 NOT NULL,
	"board" jsonb NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"map_secret" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" serial PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"participant_id" text,
	"author_name" text NOT NULL,
	"author_color" text DEFAULT '#a8998a' NOT NULL,
	"author_role" text,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"roll" jsonb,
	"dm_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"avatar" text DEFAULT 'sword' NOT NULL,
	"color" text DEFAULT '#d9822b' NOT NULL,
	"token_hash" text NOT NULL,
	"can_move" boolean DEFAULT true NOT NULL,
	"can_chat" boolean DEFAULT true NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"label" text NOT NULL,
	"board" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_idx" ON "game_sessions" ("campaign_id");--> statement-breakpoint
CREATE INDEX "messages_campaign_idx" ON "messages" ("campaign_id","id");--> statement-breakpoint
CREATE INDEX "participants_campaign_idx" ON "participants" ("campaign_id");--> statement-breakpoint
CREATE INDEX "snapshots_campaign_idx" ON "snapshots" ("campaign_id");--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;