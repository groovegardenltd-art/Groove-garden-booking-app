import { users, rooms, bookings, type User, type InsertUser, type Room, type InsertRoom, type Booking, type InsertBooking, type BookingWithRoom } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Room methods
  getAllRooms(): Promise<Room[]>;
  getRoom(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;

  // Booking methods
  getAllBookings(): Promise<Booking[]>;
  getBookingsByUser(userId: number): Promise<BookingWithRoom[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByRoomAndDate(roomId: number, date: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking & { userId: number; accessCode: string }): Promise<Booking>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<boolean>;
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
            name: "Studio A",
            description: "Full drum kit, 4-channel mixer, vocal mics",
            equipment: ["Full drum kit", "4-channel mixer", "Vocal microphones", "Amplifiers"],
            pricePerHour: "25.00",
            maxCapacity: 5,
            isActive: true,
          },
          {
            name: "Studio B",
            description: "Piano, acoustic treatment, recording setup",
            equipment: ["Yamaha P-125 Digital Piano", "Audio Interface & Monitors", "Condenser Microphones", "Acoustic Treatment"],
            pricePerHour: "35.00",
            maxCapacity: 8,
            isActive: true,
          },
          {
            name: "Studio C",
            description: "Large space, full backline, PA system",
            equipment: ["Full backline", "PA system", "Lighting rig", "Stage monitors"],
            pricePerHour: "45.00",
            maxCapacity: 12,
            isActive: true,
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

  async createBooking(booking: InsertBooking & { userId: number; accessCode: string; ttlockPasscode?: string; ttlockPasscodeId?: number; lockAccessEnabled?: boolean }): Promise<Booking> {
    const [newBooking] = await db
      .insert(bookings)
      .values({
        ...booking,
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
}

export const storage = new DatabaseStorage();
