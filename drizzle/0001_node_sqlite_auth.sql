ALTER TABLE `sessions` ADD `remember_token` text;
--> statement-breakpoint
CREATE TABLE `remember_devices` (
	`token` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `remember_devices_expiry` ON `remember_devices` (`expires`);
