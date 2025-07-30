# Music Rehearsal Studio Booking System

## Overview
A comprehensive music rehearsal studio booking system with enhanced security features, multi-hour booking capabilities, and smart lock integration. Built for musicians to easily book and access rehearsal spaces with automated access control.

## Technology Stack
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with secure ID verification
- **Smart Lock**: TTLock API integration for automated access control

## Recent Changes
- **Jul 30, 2025**: ✅ MULTI-LOCK SYSTEM IMPLEMENTED - Added support for multiple TTLock smart locks
- **Jul 30, 2025**: ✅ MAIN BUILDING LOCK CONFIGURED - Lock LL609_5aa163 (24518732) now serves as front door for Studios A & B
- **Jul 30, 2025**: Created lock management interface at `/lock-management` for configuring locks per room
- **Jul 30, 2025**: Updated database schema to store lockId and lockName for each room
- **Jul 30, 2025**: Modified TTLock service to accept specific lock IDs for each booking
- **Jul 30, 2025**: Added room-specific lock management API endpoints
- **Jul 23, 2025**: ✅ PAYMENT INTEGRATION COMPLETED - Added Stripe payment processing for all bookings
- **Jul 23, 2025**: Fixed all currency display issues - replaced remaining dollar signs with pounds (£)
- **Jul 23, 2025**: Implemented secure payment-before-booking flow with Stripe Elements
- **Jul 23, 2025**: Debugged and resolved TypeScript errors in server routes and request handling
- **Jul 30, 2025**: ✅ TTLock INTEGRATION FULLY OPERATIONAL - Real passcodes now working with correct lock IDs
- **Jul 30, 2025**: Fixed lock ID configuration - was using 534 instead of full IDs (24518732, 23687062)
- **Jul 30, 2025**: Successfully tested passcode creation - API returning keyboardPwdId confirmations
- **Jun 30, 2025**: Enhanced diagnostics reveal lock "Front door" (SN534) requires admin permissions and API access
- **Jun 30, 2025**: ✅ TIMEZONE ISSUE RESOLVED - TTLock app displays correct booking times (passcode 354185 confirmed)
- **Jun 30, 2025**: Fixed TTLock timezone calculation by subtracting 1 hour to compensate for app's +1 hour interpretation
- **Jun 30, 2025**: TTLock integration operational - real 6-digit passcodes transmitted to cloud (physical lock needs reconnection)
- **Jun 30, 2025**: Updated pricing to pounds currency (£40/1hr, £75/2hrs, £105/3hrs, £135/4hrs)
- **Jun 27, 2025**: Changed currency from dollars to pounds with new pricing structure (1hr-£40, 2hrs-£75, 3hrs-£105, 4hrs-£135)
- **Jun 27, 2025**: Completed TTLock smart lock integration with automatic passcode generation for booking time slots
- **Dec 30, 2024**: Added multi-hour booking functionality with bulk pricing discounts
- **Dec 30, 2024**: Enhanced booking calendar with duration selection and consecutive slot availability checking

## Project Architecture

### Core Features
- Room selection and availability checking
- Multi-hour booking with dynamic pricing
- User authentication and ID verification
- **Stripe payment processing** - Secure card payments required before booking confirmation
- Real-time booking management
- Smart lock integration for secure access

### Smart Lock Integration (TTLock)
- **Multi-lock support** - Each room can have its own dedicated smart lock
- Automatic access code generation for confirmed bookings
- Time-based access control aligned with booking schedules
- Remote lock management through TTLock API
- Lock management interface for easy configuration
- Room-specific access logging and monitoring

## User Preferences
- Focus on security and user experience
- Prefer automated solutions over manual processes
- Multi-hour booking capability is essential
- Smart lock integration for seamless access control

## API Integrations
- **TTLock API** for smart lock management (supports multiple locks)
- **Lock Management System** - Configure locks per room through web interface
- Booking system generates temporary access codes for specific room locks
- Access codes are time-limited to booking duration
- Environment variables: TTLOCK_CLIENT_ID, TTLOCK_CLIENT_SECRET, TTLOCK_USERNAME, TTLOCK_PASSWORD