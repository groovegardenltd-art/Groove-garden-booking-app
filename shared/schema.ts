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
  idPhotoUrl: text("id_photo_url"), // URL to uploaded ID photo
  idVerificationStatus: text("id_verification_status").default("pending"), // "pending", "verified", "rejected"
  idVerifiedAt: timestamp("id_verified_at"),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  equipment: text("equipment").array().notNull().default([]),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }).notNull(),

  isActive: boolean("is_active").notNull().default(true),
  // Time-based pricing
  dayPricePerHour: decimal("day_price_per_hour", { precision: 10, scale: 2 }),
  eveningPricePerHour: decimal("evening_price_per_hour", { precision: 10, scale: 2 }),
  dayHoursStart: text("day_hours_start").default("09:00"),
  dayHoursEnd: text("day_hours_end").default("17:00"),
  // TTLock integration
  lockId: text("lock_id"), // TTLock ID for this room's door
  lockName: text("lock_name"), // Human-readable lock name
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // "percentage" or "fixed"
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minBookingAmount: decimal("min_booking_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"), // null = unlimited
  currentUsage: integer("current_usage").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  promoCodeId: integer("promo_code_id"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("confirmed"), // confirmed, cancelled, completed
  contactPhone: text("contact_phone"),

  specialRequests: text("special_requests"),
  accessCode: text("access_code").notNull(),
  // TTLock integration fields
  ttlockPasscode: text("ttlock_passcode"),
  ttlockPasscodeId: text("ttlock_passcode_id"),
  lockAccessEnabled: boolean("lock_access_enabled").notNull().default(false),
  // ID verification for self-entry studio
  idNumber: text("id_number"),
  idType: text("id_type"), // "drivers_license", "passport", "state_id", etc.
  idPhotoUrl: text("id_photo_url"), // URL to uploaded ID photo for this booking
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

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  currentUsage: true,
  createdAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  userId: true,
  accessCode: true,
  createdAt: true,
}).extend({
  contactPhone: z.string().min(1, "Phone number is required"),
  idNumber: z.string().min(1, "ID number is required for studio access"),
  idType: z.string().min(1, "ID type is required"),
  totalPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  promoCode: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type BookingWithRoom = Booking & {
  room: Room;
};
