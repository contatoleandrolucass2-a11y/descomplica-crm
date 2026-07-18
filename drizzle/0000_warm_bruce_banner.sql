CREATE TABLE `collaborator_dashboards` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`manager` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'Colaborador' NOT NULL,
	`generated_at` text NOT NULL,
	`reference_date` text NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow` text NOT NULL,
	`generated_at` text NOT NULL,
	`collaborator_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
