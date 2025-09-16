import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./password-utils";

/**
 * Securely seeds admin users using environment variables for credentials.
 * Only runs when ENABLE_ADMIN_SEEDING=true to prevent accidental seeding.
 */
export async function seedAdminUsers() {
  // Security gate: Only seed when explicitly enabled
  if (process.env.ENABLE_ADMIN_SEEDING !== 'true') {
    console.log('⚠️  Admin seeding disabled. Set ENABLE_ADMIN_SEEDING=true to enable.');
    return;
  }

  // Validate required environment variables
  const requiredEnvVars = [
    'ADMIN_USERNAME_1', 'ADMIN_EMAIL_1', 'ADMIN_NAME_1', 'ADMIN_PHONE_1', 'ADMIN_PASSWORD_1',
    'ADMIN_USERNAME_2', 'ADMIN_EMAIL_2', 'ADMIN_NAME_2', 'ADMIN_PHONE_2', 'ADMIN_PASSWORD_2'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables for admin seeding:', missingVars.join(', '));
    throw new Error(`Missing admin environment variables: ${missingVars.join(', ')}`);
  }

  const adminUsers = [
    {
      username: process.env.ADMIN_USERNAME_1!,
      email: process.env.ADMIN_EMAIL_1!, 
      name: process.env.ADMIN_NAME_1!,
      phone: process.env.ADMIN_PHONE_1!,
      password: process.env.ADMIN_PASSWORD_1!
    },
    {
      username: process.env.ADMIN_USERNAME_2!,
      email: process.env.ADMIN_EMAIL_2!,
      name: process.env.ADMIN_NAME_2!, 
      phone: process.env.ADMIN_PHONE_2!,
      password: process.env.ADMIN_PASSWORD_2!
    }
  ];

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    console.log('🌱 Seeding admin users...');
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const adminData of adminUsers) {
    try {
      // Hash the password
      const hashedPassword = await hashPassword(adminData.password);

      // Use atomic upsert to prevent race conditions
      // This will insert if not exists, or update if exists
      const [result] = await db
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
        .onConflictDoUpdate({
          target: users.username,
          set: {
            email: adminData.email,
            name: adminData.name,
            phone: adminData.phone,
            password: hashedPassword,
            idVerificationStatus: "verified",
            idVerifiedAt: new Date()
          }
        })
        .returning();

      successCount++;
      if (!isProduction) {
        console.log(`✅ Admin user '${adminData.username}' processed successfully (ID: ${result.id})`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to process admin user '${adminData.username}':`, isProduction ? '[Error details hidden in production]' : error);
    }
  }

  if (!isProduction) {
    console.log(`🌱 Admin seeding completed: ${successCount} successful, ${errorCount} errors`);
  } else {
    console.log(`Admin seeding completed: ${successCount}/${adminUsers.length} successful`);
  }
}

// Only run this script directly if called from command line (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  // ES modules detection for direct execution
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