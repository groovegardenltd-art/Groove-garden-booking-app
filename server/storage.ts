import { users, rooms, bookings, promoCodes, type User, type InsertUser, type Room, type InsertRoom, type Booking, type InsertBooking, type BookingWithRoom, type PromoCode, type InsertPromoCode } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getUsersPendingVerification(): Promise<User[]>;

  // Room methods
  getAllRooms(): Promise<Room[]>;
  getRoom(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;

  // Booking methods
  getAllBookings(): Promise<Booking[]>;
  getBookingsByUser(userId: number): Promise<BookingWithRoom[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByRoomAndDate(roomId: number, date: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking & { userId: number; accessCode: string; ttlockPasscode?: string; ttlockPasscodeId?: string; lockAccessEnabled?: boolean; promoCodeId?: number; originalPrice?: string; discountAmount?: string }): Promise<Booking>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<boolean>;

  // Promo code methods
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  validatePromoCode(code: string, bookingAmount: number): Promise<{ valid: boolean; promoCode?: PromoCode; error?: string }>;
  incrementPromoCodeUsage(promoCodeId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with sample rooms if they don't exist
    this.initializeRooms();
  }

  private async initializeRooms() {
    try {
      const existingRooms = await db.select().from(rooms);
      
      if (existingRooms.length === 0) {
        const sampleRooms: InsertRoom[] = [
          {
            name: "Pod 1",
            description: "Compact rehearsal space with full drum kit and amplification",
            equipment: ["Pearl Export 5-piece drum kit", "2x guitar amplifiers (Marshall & Fender)", "Bass amplifier", "4-channel mixing desk", "Shure SM58 vocal microphones", "Direct injection boxes", "Monitor speakers"],
            pricePerHour: "7.00",
            dayPricePerHour: "7.00",
            eveningPricePerHour: "9.00",
            isActive: true,
            lockId: process.env.TTLOCK_LOCK_ID_A || process.env.TTLOCK_LOCK_ID || '',
            lockName: "Pod 1 Door",
          },
          {
            name: "Pod 2", 
            description: "Versatile studio with piano and recording capabilities",
            equipment: ["Yamaha P-125 digital piano", "Roland TD-17 electronic drum kit", "Guitar amplifier (Vox AC30)", "Bass amplifier", "Audio interface (Focusrite Scarlett)", "Studio monitors", "Condenser & dynamic microphones", "Acoustic treatment panels"],
            pricePerHour: "7.00",
            dayPricePerHour: "7.00",
            eveningPricePerHour: "9.00",
            isActive: true,
            lockId: process.env.TTLOCK_LOCK_ID_B || '',
            lockName: "Pod 2 Door",
          },
          {
            name: "Live Room",
            description: "Premium performance space with full backline and PA system",
            equipment: ["Professional backline (Marshall JCM800, Ampeg SVT, Pearl Masters drum kit)", "16-channel PA system with subs", "Stage lighting rig", "Wireless microphone system", "8x stage monitors", "Professional cables & DI boxes", "Merchandise tables", "Green room area"],
            pricePerHour: "13.00",
            dayPricePerHour: "13.00",
            eveningPricePerHour: "18.00",
            isActive: true,
            lockId: process.env.TTLOCK_LOCK_ID_C || '',
            lockName: "Live Room Door",
          },
        ];

        await db.insert(rooms).values(sampleRooms);
      }
    } catch (error) {
      console.error('Failed to initialize rooms:', error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPhone(id: number, phone: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ phone })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUsersPendingVerification(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.idVerificationStatus, "pending"));
  }

  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isActive, true));
  }

  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values(insertRoom)
      .returning();
    return room;
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings);
  }

  async getBookingsByUser(userId: number): Promise<BookingWithRoom[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(eq(bookings.userId, userId))
      .orderBy(bookings.createdAt);

    return result.map(row => ({
      ...row.bookings,
      room: row.rooms!
    }));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getBookingsByRoomAndDate(roomId: number, date: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, roomId),
          eq(bookings.date, date),
          eq(bookings.status, "confirmed")
        )
      );
  }

  async createBooking(booking: InsertBooking & { userId: number; accessCode: string; ttlockPasscode?: string; ttlockPasscodeId?: string; lockAccessEnabled?: boolean; promoCodeId?: number; originalPrice?: string; discountAmount?: string }): Promise<Booking> {
    const [newBooking] = await db
      .insert(bookings)
      .values({
        ...booking,
        ttlockPasscodeId: booking.ttlockPasscodeId || null,
        status: "confirmed"
      })
      .returning();
    return newBooking;
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id))
      .returning();
    return booking || undefined;
  }

  async cancelBooking(id: number): Promise<boolean> {
    const result = await db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, id))
      .returning();
    return result.length > 0;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code.toUpperCase()));
    return promoCode || undefined;
  }

  async validatePromoCode(code: string, bookingAmount: number): Promise<{ valid: boolean; promoCode?: PromoCode; error?: string }> {
    const promoCode = await this.getPromoCodeByCode(code);
    
    if (!promoCode) {
      return { valid: false, error: "Promo code not found" };
    }

    if (!promoCode.isActive) {
      return { valid: false, error: "Promo code is no longer active" };
    }

    const now = new Date();
    
    if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
      return { valid: false, error: "Promo code is not yet valid" };
    }

    if (promoCode.validTo && new Date(promoCode.validTo) < now) {
      return { valid: false, error: "Promo code has expired" };
    }

    if (promoCode.usageLimit && promoCode.currentUsage >= promoCode.usageLimit) {
      return { valid: false, error: "Promo code usage limit reached" };
    }

    if (promoCode.minBookingAmount && bookingAmount < Number(promoCode.minBookingAmount)) {
      return { valid: false, error: `Minimum booking amount of £${promoCode.minBookingAmount} required` };
    }

    return { valid: true, promoCode };
  }

  async incrementPromoCodeUsage(promoCodeId: number): Promise<void> {
    const [currentCode] = await db.select().from(promoCodes).where(eq(promoCodes.id, promoCodeId));
    if (currentCode) {
      await db
        .update(promoCodes)
        .set({ currentUsage: currentCode.currentUsage + 1 })
        .where(eq(promoCodes.id, promoCodeId));
    }
  }
}

export const storage = new DatabaseStorage();
