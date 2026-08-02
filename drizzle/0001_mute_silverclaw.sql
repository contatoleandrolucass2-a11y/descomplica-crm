CREATE TABLE `point_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`weights_json` text NOT NULL,
	`targets_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
