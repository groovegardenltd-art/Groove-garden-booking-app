# Music Rehearsal Studio Booking System

## Overview
A comprehensive music rehearsal studio booking system designed for musicians to easily book and access rehearsal spaces. The system features enhanced security, multi-hour booking capabilities, and automated access control via smart lock integration. Its purpose is to streamline the booking process and provide secure, automated access to music rehearsal studios, ensuring a seamless user experience.

## User Preferences
- Focus on security and user experience
- Prefer automated solutions over manual processes
- Multi-hour booking capability is essential
- Smart lock integration for seamless access control

## System Architecture
The system is built with a React (TypeScript, Tailwind CSS, shadcn/ui) frontend, an Express.js (TypeScript) backend, and a PostgreSQL database with Drizzle ORM. Authentication is session-based with secure ID verification.

### UI/UX Decisions
- Mobile-first design with optimized loading performance.
- Use of shadcn/ui components for a consistent and modern look.
- Loading skeletons and smart caching for improved user experience, especially in the booking calendar.
- GDPR-compliant cookie consent banner and privacy policy page.

### Technical Implementations
- **Room Selection & Availability**: Users can select rooms and check real-time availability.
- **Multi-Hour Booking & Dynamic Pricing**: Supports booking multiple consecutive hours with bulk discounts and time-based hourly rates.
- **User Authentication & ID Verification**: Secure session-based authentication with a one-time manual ID verification process for new users. ID photos are stored securely in Replit Object Storage.
- **Payment Processing**: Integrated Stripe for secure, pre-booking payment processing.
- **Smart Lock Integration**: Automated generation and synchronization of time-limited access codes with TTLock smart locks for booked sessions. Supports multiple locks and includes a lock management interface. All studios use a unified front door lock (LL609_5aa163, ID 24518732).
- **GDPR Compliance**: Includes features for data portability, account deletion, explicit consent management, and third-party disclosures.
- **Booking Resilience**: Implemented retry logic with exponential backoff for booking creation after payment to handle transient errors. Auto-refund only triggers if the booking was NOT successfully created — prevents false refunds when post-booking steps (email, promo code) fail after a successful booking.
- **Admin Features**: Comprehensive admin panel for booking management (cancel/edit), ID verification review, and lock management.

### Feature Specifications
- **Pricing Structure**: Variable hourly rates based on time of day (e.g., £7/hr or £13/hr for day, £9/hr or £18/hr for evening). Bulk discount of 10% for bookings over 4 hours.
- **Booking Hours**: Studios open 9am-midnight, Monday-Saturday, with a maximum booking duration of 12 hours. The Live Room has a 3-hour minimum for evening bookings.
- **Promo Code System**: Full functionality for discount codes at checkout.
- **Security**: One-time ID verification with manual staff review and permanent verification status. Photo ID upload with validation and audit trail. Critical security fixes include proper passcode deletion and payment verification with Stripe before booking confirmation.

## External Dependencies
- **Stripe**: Payment processing for all bookings.
- **TTLock API**: Smart lock management and automated access control.
- **Replit Object Storage**: Secure storage for ID verification photos.
- **SendGrid**: (Implied by GDPR disclosures, likely for email notifications/password resets)
- **Neon**: (Implied by GDPR disclosures, likely database hosting or related service)