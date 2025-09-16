import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./password-utils";
import { eq } from "drizzle-orm";

/**
 * Seeds the database with admin users for both development and production environments
 */
export async function seedAdminUsers() {
  const adminUsers = [
    {
      username: "grooveadmin",
      email: "groovegardenltd@gmail.com", 
      name: "Groove Admin",
      phone: "+44 7123 456789",
      password: "Tootingtram1@"
    },
    {
      username: "grooveadmin2",
      email: "grooveadmin@gmail.com",
      name: "Groove Admin 2", 
      phone: "+44 7123 456790",
      password: "Tootingtram1@"
    }
  ];

  console.log("🌱 Seeding admin users...");
  
  for (const adminData of adminUsers) {
    try {
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, adminData.username));

      if (existingUser) {
        console.log(`✅ Admin user '${adminData.username}' already exists (ID: ${existingUser.id})`);
        continue;
      }

      // Hash the password
      const hashedPassword = await hashPassword(adminData.password);

      // Create the admin user
      const [newUser] = await db
        .insert(users)
        .values({
          username: adminData.username,
          email: adminData.email,
          name: adminData.name,
          phone: adminData.phone,
          password: hashedPassword,
          idVerificationStatus: "verified", // Admin users are pre-verified
          idVerifiedAt: new Date()
        })
        .returning();

      console.log(`✅ Created admin user '${adminData.username}' (ID: ${newUser.id})`);
    } catch (error) {
      console.error(`❌ Failed to create admin user '${adminData.username}':`, error);
    }
  }

  console.log("🌱 Admin user seeding completed");
}

// Run this script directly if called from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdminUsers()
    .then(() => {
      console.log("✅ Seeding completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}