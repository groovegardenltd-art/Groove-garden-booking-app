import { users, rooms, bookings, promoCodes, blockedSlots, type User, type InsertUser, type Room, type InsertRoom, type Booking, type InsertBooking, type BookingWithRoom, type PromoCode, type InsertPromoCode, type BlockedSlot, type InsertBlockedSlot } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./password-utils";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getUsersPendingVerification(): Promise<User[]>;
  setUserResetToken(userId: number, resetToken: string, expiryDate: Date): Promise<boolean>;
  getUserByResetToken(resetToken: string): Promise<User | undefined>;
  clearUserResetToken(userId: number): Promise<boolean>;

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
  validatePromoCode(code: string, bookingAmount: number, roomId?: number): Promise<{ valid: boolean; promoCode?: PromoCode; error?: string }>;
  incrementPromoCodeUsage(promoCodeId: number): Promise<void>;

  // Blocked slots methods
  getAllBlockedSlots(): Promise<BlockedSlot[]>;
  getBlockedSlotsByRoomAndDate(roomId: number, date: string): Promise<BlockedSlot[]>;
  createBlockedSlot(blockedSlot: InsertBlockedSlot & { createdBy: number }): Promise<BlockedSlot>;
  deleteBlockedSlot(id: number): Promise<boolean>;
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
            description: "Pod with full drum kit and cymbals",
            equipment: ["Full drum kit with cymbals"],
            pricePerHour: "7.00",
            dayPricePerHour: null,
            eveningPricePerHour: null,
            isActive: true,
            lockId: process.env.TTLOCK_LOCK_ID_A || process.env.TTLOCK_LOCK_ID || '',
            lockName: "Pod 1 Door",
          },
          {
            name: "Pod 2", 
            description: "Pod with full drum kit and cymbals",
            equipment: ["Full drum kit with cymbals"],
            pricePerHour: "7.00",
            dayPricePerHour: null,
            eveningPricePerHour: null,
            isActive: true,
            lockId: process.env.TTLOCK_LOCK_ID_B || '',
            lockName: "Pod 2 Door",
          },
          {
            name: "Live Room",
            description: "Premium performance space with full backline and PA system",
            equipment: ["Full PA and mixer", "Full drum kit", "2x bass amps", "2x guitar amps", "6 mics", "keyboard"],
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
    // Hash the password before storing
    const hashedPassword = await hashPassword(insertUser.password);
    const userWithHashedPassword = { ...insertUser, password: hashedPassword };
    
    const [user] = await db
      .insert(users)
      .values(userWithHashedPassword)
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

  async validatePromoCode(code: string, bookingAmount: number, roomId?: number): Promise<{ valid: boolean; promoCode?: PromoCode; error?: string }> {
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

    // Check room restrictions
    if (promoCode.applicableRoomIds && promoCode.applicableRoomIds.length > 0 && roomId) {
      if (!promoCode.applicableRoomIds.includes(roomId)) {
        return { valid: false, error: "This promo code is not valid for the selected room" };
      }
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

  async setUserResetToken(userId: number, resetToken: string, expiryDate: Date): Promise<boolean> {
    try {
      const [user] = await db
        .update(users)
        .set({ 
          resetToken,
          resetTokenExpiry: expiryDate 
        })
        .where(eq(users.id, userId))
        .returning();
      return !!user;
    } catch (error) {
      console.error('Failed to set reset token:', error);
      return false;
    }
  }

  async getUserByResetToken(resetToken: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.resetToken, resetToken),
          // Only return user if token hasn't expired
          // resetTokenExpiry > now
        ));
      
      // Check if token is still valid (not expired)
      if (user && user.resetTokenExpiry && new Date(user.resetTokenExpiry) > new Date()) {
        return user;
      }
      return undefined;
    } catch (error) {
      console.error('Failed to get user by reset token:', error);
      return undefined;
    }
  }

  async clearUserResetToken(userId: number): Promise<boolean> {
    try {
      const [user] = await db
        .update(users)
        .set({ 
          resetToken: null,
          resetTokenExpiry: null 
        })
        .where(eq(users.id, userId))
        .returning();
      return !!user;
    } catch (error) {
      console.error('Failed to clear reset token:', error);
      return false;
    }
  }

  // Blocked slots methods
  async getAllBlockedSlots(): Promise<BlockedSlot[]> {
    return await db.select().from(blockedSlots);
  }

  async getBlockedSlotsByRoomAndDate(roomId: number, date: string): Promise<BlockedSlot[]> {
    return await db
      .select()
      .from(blockedSlots)
      .where(and(eq(blockedSlots.roomId, roomId), eq(blockedSlots.date, date)));
  }

  async createBlockedSlot(insertBlockedSlot: InsertBlockedSlot & { createdBy: number }): Promise<BlockedSlot> {
    const [blockedSlot] = await db
      .insert(blockedSlots)
      .values(insertBlockedSlot)
      .returning();
    return blockedSlot;
  }

  async deleteBlockedSlot(id: number): Promise<boolean> {
    try {
      const result = await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Failed to delete blocked slot:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
