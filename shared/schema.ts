import { pgTable, text, serial, integer, boolean, timestamp, decimal, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  idNumber: text("id_number"),
  idType: text("id_type"), // "drivers_license", "passport", "state_id", etc.
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  equipment: text("equipment").array().notNull().default([]),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }).notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // TTLock integration
  lockId: text("lock_id"), // TTLock ID for this room's door
  lockName: text("lock_name"), // Human-readable lock name
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  roomId: integer("room_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  duration: integer("duration").notNull(), // in hours
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("confirmed"), // confirmed, cancelled, completed
  contactPhone: text("contact_phone"),
  numberOfPeople: integer("number_of_people").notNull().default(1),
  specialRequests: text("special_requests"),
  accessCode: text("access_code").notNull(),
  // TTLock integration fields
  ttlockPasscode: text("ttlock_passcode"),
  ttlockPasscodeId: text("ttlock_passcode_id"),
  lockAccessEnabled: boolean("lock_access_enabled").notNull().default(false),
  // ID verification for self-entry studio
  idNumber: text("id_number"),
  idType: text("id_type"), // "drivers_license", "passport", "state_id", etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  userId: true,
  accessCode: true,
  createdAt: true,
}).extend({
  contactPhone: z.string().min(1, "Phone number is required"),
  numberOfPeople: z.number().min(1, "Number of people must be at least 1"),
  idNumber: z.string().min(1, "ID number is required for studio access"),
  idType: z.string().min(1, "ID type is required"),
  totalPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type BookingWithRoom = Booking & {
  room: Room;
};
