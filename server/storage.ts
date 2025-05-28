import { users, rooms, bookings, type User, type InsertUser, type Room, type InsertRoom, type Booking, type InsertBooking, type BookingWithRoom } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rooms: Map<number, Room>;
  private bookings: Map<number, Booking>;
  private currentUserId: number;
  private currentRoomId: number;
  private currentBookingId: number;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.bookings = new Map();
    this.currentUserId = 1;
    this.currentRoomId = 1;
    this.currentBookingId = 1;

    // Initialize with sample rooms
    this.initializeRooms();
  }

  private initializeRooms() {
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

    sampleRooms.forEach(room => {
      const id = this.currentRoomId++;
      const newRoom: Room = { ...room, id };
      this.rooms.set(id, newRoom);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Room methods
  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter(room => room.isActive);
  }

  async getRoom(id: number): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = this.currentRoomId++;
    const room: Room = { ...insertRoom, id };
    this.rooms.set(id, room);
    return room;
  }

  // Booking methods
  async getAllBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getBookingsByUser(userId: number): Promise<BookingWithRoom[]> {
    const userBookings = Array.from(this.bookings.values()).filter(
      booking => booking.userId === userId
    );
    
    const bookingsWithRooms: BookingWithRoom[] = [];
    for (const booking of userBookings) {
      const room = this.rooms.get(booking.roomId);
      if (room) {
        bookingsWithRooms.push({ ...booking, room });
      }
    }
    
    return bookingsWithRooms.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByRoomAndDate(roomId: number, date: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      booking => booking.roomId === roomId && 
                 booking.date === date && 
                 booking.status !== "cancelled"
    );
  }

  async createBooking(booking: InsertBooking & { userId: number; accessCode: string }): Promise<Booking> {
    const id = this.currentBookingId++;
    const newBooking: Booking = { 
      ...booking, 
      id,
      createdAt: new Date()
    };
    this.bookings.set(id, newBooking);
    return newBooking;
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (booking) {
      booking.status = status;
      this.bookings.set(id, booking);
      return booking;
    }
    return undefined;
  }

  async cancelBooking(id: number): Promise<boolean> {
    const booking = this.bookings.get(id);
    if (booking) {
      booking.status = "cancelled";
      this.bookings.set(id, booking);
      return true;
    }
    return false;
  }
}

export const storage = new MemStorage();
