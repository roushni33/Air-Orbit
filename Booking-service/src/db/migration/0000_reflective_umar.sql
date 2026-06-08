CREATE TYPE "public"."status" AS ENUM('booked', 'cancelled', 'initiated', 'pending');--> statement-breakpoint
CREATE TYPE "public"."seat_class" AS ENUM('economy', 'premium-economy', 'business', 'first-class');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "status" DEFAULT 'initiated' NOT NULL,
	"total_cost" integer NOT NULL,
	"no_of_seats" integer,
	"seat_class" "seat_class",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
