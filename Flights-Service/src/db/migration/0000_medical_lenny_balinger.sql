CREATE TYPE "public"."seat_type" AS ENUM('business', 'economy', 'premium-economy', 'first-class');--> statement-breakpoint
CREATE TYPE "public"."stop_type" AS ENUM('DIRECT', 'ONE_STOP');--> statement-breakpoint
CREATE TYPE "public"."flight_class_type" AS ENUM('economy', 'premium-economy', 'business', 'first-class');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "airports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"address" varchar(255),
	"city_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "airports_name_unique" UNIQUE("name"),
	CONSTRAINT "airports_code_unique" UNIQUE("code"),
	CONSTRAINT "airports_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "airplanes" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_number" varchar(255) NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"row" integer NOT NULL,
	"col" varchar(255) NOT NULL,
	"airplane_id" integer NOT NULL,
	"type" "seat_type" DEFAULT 'economy' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flights" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_number" varchar(255) NOT NULL,
	"airplane_id" integer NOT NULL,
	"departure_airport_id" varchar(255) NOT NULL,
	"arrival_airport_id" varchar(255) NOT NULL,
	"arrival_time" timestamp NOT NULL,
	"departure_time" timestamp NOT NULL,
	"price" integer NOT NULL,
	"boarding_gate" varchar(255),
	"total_seats" integer NOT NULL,
	"stop_type" "stop_type" DEFAULT 'DIRECT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"seat_class" "flight_class_type" NOT NULL,
	"price" integer NOT NULL,
	"total_seats" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"airport_code" varchar(255) NOT NULL,
	"arrival_time" timestamp NOT NULL,
	"departure_time" timestamp NOT NULL,
	"layover_mins" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "airports" ADD CONSTRAINT "airports_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_airplane_id_airplanes_id_fk" FOREIGN KEY ("airplane_id") REFERENCES "public"."airplanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flights" ADD CONSTRAINT "flights_airplane_id_airplanes_id_fk" FOREIGN KEY ("airplane_id") REFERENCES "public"."airplanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_classes" ADD CONSTRAINT "flight_classes_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_stops" ADD CONSTRAINT "flight_stops_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE cascade ON UPDATE no action;