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
- **Oct 20, 2025**: ✅ BLOCKED SLOTS VALIDATION COMPLETE - Availability API correctly returns blocked slots, booking validation prevents conflicts, awaiting production deployment
- **Oct 17, 2025**: ✅ PERFORMANCE OPTIMIZATION - Implemented lazy loading for all routes to reduce initial bundle size and improve mobile load times. Pages now load on-demand with code splitting.
- **Oct 17, 2025**: ✅ ADMIN BOOKING MANAGEMENT - Added cancel and edit booking functionality in admin calendar with automatic TTLock passcode updates
- **Oct 06, 2025**: ✅ CRITICAL PAYMENT-TO-BOOKING BUG FIXED - Resolved silent failure when payment succeeded but booking failed due to session expiration. Fixed apiRequest to throw error before redirecting on 401, ensuring users see error messages and mutations can properly handle authentication failures.
- **Sep 19, 2025**: ✅ ID VERIFICATION PHOTO DISPLAY FIXED - Resolved missing photo buttons in admin panel by implementing lazy loading architecture and adding "ID Check" navigation button for direct access to `/admin/id-verification`
- **Sep 16, 2025**: ✅ PASSWORD RESET FUNCTIONALITY COMPLETED - Secure forgot password with email tokens, works in all environments
- **Sep 16, 2025**: ✅ ADMIN ACCOUNT READY - Password reset and confirmed working on published site (username: grooveadmin)
- **Sep 01, 2025**: ✅ MOBILE PHONE COLLECTION ON REGISTRATION - Required field during account signup with UK formatting and validation
- **Sep 01, 2025**: ✅ ONE-TIME ID VERIFICATION SYSTEM - Manual staff review with photo upload, permanent user verification status
- **Sep 01, 2025**: ✅ ADMIN INTERFACE COMPLETED - Dedicated ID verification review page at /admin/id-verification for staff
- **Sep 01, 2025**: ✅ ENHANCED SECURITY - Photo ID upload with file validation, cross-reference verification, audit trail
- **Aug 26, 2025**: ✅ UI SIMPLIFICATION - Removed Smart Lock tab from navigation (functionality remains in backend for automated access)
- **Aug 26, 2025**: ✅ PROMO CODE SYSTEM COMPLETED - Full promo code functionality with validation, discount calculation, and checkout integration
- **Jul 30, 2025**: ✅ MULTI-LOCK SYSTEM IMPLEMENTED - Added support for multiple TTLock smart locks
- **Jul 30, 2025**: ✅ UNIFIED ACCESS CONTROL - All studios now use front door lock LL609_5aa163 (24518732) for consistent entry
- **Jul 30, 2025**: Created lock management interface at `/lock-management` for configuring locks per room
- **Jul 30, 2025**: Updated database schema to store lockId and lockName for each room
- **Jul 30, 2025**: Modified TTLock service to accept specific lock IDs for each booking
- **Jul 30, 2025**: Added room-specific lock management API endpoints
- **Jul 23, 2025**: ✅ PAYMENT INTEGRATION COMPLETED - Added Stripe payment processing for all bookings
- **Jul 23, 2025**: Fixed all currency display issues - replaced remaining dollar signs with pounds (£)
- **Jul 23, 2025**: Implemented secure payment-before-booking flow with Stripe Elements
- **Jul 23, 2025**: Debugged and resolved TypeScript errors in server routes and request handling
- **Aug 09, 2025**: ✅ TTLock HARDWARE SYNC WORKING! - Confirmed 3011233348# unlocks physical lock
- **Aug 09, 2025**: Final working pattern: *30+1123334+digit (10 digits) - tested and verified on hardware
- **Aug 09, 2025**: Live test successful: Code 3011233348 unlocked lock at 08:19 as scheduled
- **Aug 09, 2025**: Booking system generates unique working passcodes that reliably sync to TTLock hardware
- **Jul 30, 2025**: Fixed lock ID configuration - was using 534 instead of full IDs (24518732, 23687062)
- **Jul 30, 2025**: Successfully tested passcode creation - API returning keyboardPwdId confirmations
- **Jun 30, 2025**: Enhanced diagnostics reveal lock "Front door" (SN534) requires admin permissions and API access
- **Jun 30, 2025**: ✅ TIMEZONE ISSUE RESOLVED - TTLock app displays correct booking times (passcode 354185 confirmed)
- **Jun 30, 2025**: Fixed TTLock timezone calculation by subtracting 1 hour to compensate for app's +1 hour interpretation
- **Jun 30, 2025**: TTLock integration operational - real 6-digit passcodes transmitted to cloud (physical lock needs reconnection)
- **Aug 18, 2025**: ✅ BULK DISCOUNT IMPLEMENTED - 10% off all bookings over 4 hours
- **Aug 18, 2025**: ✅ BUSINESS HOURS UPDATED - Studios open 9am-midnight, Monday-Saturday
- **Aug 18, 2025**: ✅ EXTENDED BOOKING HOURS - Users can now book up to 12 hours maximum
- **Aug 18, 2025**: ✅ TIME-BASED PRICING IMPLEMENTED - All rooms now use hourly rates based on time of day
- **Aug 26, 2025**: ✅ PRICING UPDATED - Pod 1 & Pod 2: £7/hr (9am-5pm), £9/hr (5pm-midnight)
- **Aug 26, 2025**: ✅ PRICING UPDATED - Live Room: £13/hr (9am-5pm), £18/hr (5pm-midnight)
- **Aug 18, 2025**: ✅ CAPACITY TRACKING REMOVED - Eliminated room capacity limits and people count requirements
- **Aug 18, 2025**: ✅ PRICING TIME UPDATED - Changed day rate hours from 6am-5pm to 9am-5pm throughout system
- **Sep 01, 2025**: ✅ LIVE ROOM MINIMUM UPDATED - 3-hour evening minimum now applies only to Live Room, pods have no minimum
- **Aug 18, 2025**: ✅ EVENING MINIMUM BOOKING - Implemented 3-hour minimum for all evening bookings (5pm onwards)
- **Aug 18, 2025**: ✅ SINGLE-CLICK BOOKING - Streamlined booking process to one-click confirmation in test mode
- **Aug 18, 2025**: ✅ UI IMPROVEMENTS - Removed special requests section, changed "backup access code" to "access code", added # symbol to codes
- **Jun 30, 2025**: Updated pricing to pounds currency (£40/1hr, £75/2hrs, £105/3hrs, £135/4hrs)
- **Jun 27, 2025**: Changed currency from dollars to pounds with new pricing structure (1hr-£40, 2hrs-£75, 3hrs-£105, 4hrs-£135)
- **Jun 27, 2025**: Completed TTLock smart lock integration with automatic passcode generation for booking time slots
- **Dec 30, 2024**: Added multi-hour booking functionality with bulk pricing discounts
- **Dec 30, 2024**: Enhanced booking calendar with duration selection and consecutive slot availability checking

## Project Architecture

### Core Features
- Room selection and availability checking
- Multi-hour booking with dynamic pricing
- User authentication and **one-time ID verification**
- **Manual staff review system** - Photo ID upload with permanent verification status
- **Stripe payment processing** - Secure card payments required before booking confirmation
- Real-time booking management
- Smart lock integration for secure access

### Smart Lock Integration (TTLock)
- **Unified front door access** - All studios use single front door lock LL609_5aa163 (24518732)
- Automatic access code generation for confirmed bookings
- Time-based access control aligned with booking schedules
- Remote lock management through TTLock API
- Lock management interface for easy configuration
- Centralized access logging and monitoring

## User Preferences
- Focus on security and user experience
- Prefer automated solutions over manual processes
- Multi-hour booking capability is essential
- Smart lock integration for seamless access control

## API Integrations
- **TTLock API** for smart lock management (supports multiple locks)
- **Lock Management System** - Configure locks per room through web interface
- **ID Verification System** - Manual staff review with photo upload and permanent user status
- Booking system generates temporary access codes for specific room locks
- Access codes are time-limited to booking duration
- Environment variables: TTLOCK_CLIENT_ID, TTLOCK_CLIENT_SECRET, TTLOCK_USERNAME, TTLOCK_PASSWORD

## Security Features
- **One-time ID verification** - Users upload photo ID once, staff manually review
- **Permanent verification status** - Verified users skip ID requirements for all future bookings
- **Admin review interface** - Dedicated page at /admin/id-verification for staff approval/rejection
- **Photo validation** - File type and size limits with preview functionality
- **Audit trail** - Verification timestamps and status tracking for security compliance