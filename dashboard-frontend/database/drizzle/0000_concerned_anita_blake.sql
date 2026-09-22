CREATE TABLE `cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`population` integer NOT NULL,
	`population_density` real NOT NULL,
	`total_area` real NOT NULL,
	`built_up_area` real NOT NULL,
	`industrial_area` real NOT NULL,
	`residential_area` real NOT NULL,
	`road_area` real NOT NULL,
	`open_land` real NOT NULL,
	`water_bodies_area` real NOT NULL,
	`forest_cover` real NOT NULL,
	`urban_green_space` real NOT NULL,
	`tree_density` real NOT NULL,
	`ndvi` real NOT NULL,
	`total_vehicles` integer NOT NULL,
	`petrol_vehicles` integer NOT NULL,
	`diesel_vehicles` integer NOT NULL,
	`electric_vehicles` integer NOT NULL,
	`cng_vehicles` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_name_unique` ON `cities` (`name`);--> statement-breakpoint
CREATE TABLE `weather_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`temperature` real NOT NULL,
	`feels_like` real NOT NULL,
	`humidity` integer NOT NULL,
	`wind_speed` real NOT NULL,
	`pressure` integer NOT NULL,
	`cloud_cover` integer NOT NULL,
	`rainfall` real DEFAULT 0 NOT NULL,
	`uv_index` real,
	`weather_main` text NOT NULL,
	`weather_description` text NOT NULL,
	`recorded_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `heat_predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`heat_risk_score` real NOT NULL,
	`heat_zone` text NOT NULL,
	`temperature` real NOT NULL,
	`humidity` integer NOT NULL,
	`vehicle_density` real NOT NULL,
	`population_density` real NOT NULL,
	`green_cover_ratio` real NOT NULL,
	`built_up_ratio` real NOT NULL,
	`cooling_index` real NOT NULL,
	`traffic_heat_factor` real NOT NULL,
	`predicted_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`priority` text NOT NULL,
	`impact` text NOT NULL,
	`icon` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action
);
