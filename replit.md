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
- **Jun 30, 2025**: FINAL FIX - TTLock timezone issue resolved by subtracting 1 hour to compensate for app's +1 hour timezone interpretation
- **Jun 30, 2025**: Fixed TTLock timing issue - removed 1-minute adjustment that caused "14:59" display instead of "14:00" in TTLock app
- **Jun 30, 2025**: Updated date parsing to use UTC format preventing timezone conversion errors in passcode transmission
- **Jun 30, 2025**: TTLock integration fully tested and operational - confirmed real passcodes sent to physical lock
- **Jun 30, 2025**: Fixed time display formatting across all components to properly handle minutes
- **Jun 30, 2025**: Updated pricing display to pounds currency throughout booking interface
- **Jun 30, 2025**: TTLock API integration confirmed working - successfully sending real 6-digit passcodes to physical smart lock hardware (lock ID 23687062)
- **Jun 30, 2025**: Fixed MD5 password encryption and lock ID configuration for TTLock authentication
- **Jun 27, 2025**: Changed currency from dollars to pounds with new pricing structure (1hr-£40, 2hrs-£75, 3hrs-£105, 4hrs-£135)
- **Jun 27, 2025**: Completed TTLock smart lock integration with automatic passcode generation for booking time slots
- **Dec 30, 2024**: Added multi-hour booking functionality with bulk pricing discounts
- **Dec 30, 2024**: Enhanced booking calendar with duration selection and consecutive slot availability checking

## Project Architecture

### Core Features
- Room selection and availability checking
- Multi-hour booking with dynamic pricing
- User authentication and ID verification
- Real-time booking management
- Smart lock integration for secure access

### Smart Lock Integration (TTLock)
- Automatic access code generation for confirmed bookings
- Time-based access control aligned with booking schedules
- Remote lock management through TTLock API
- Access logging and monitoring

## User Preferences
- Focus on security and user experience
- Prefer automated solutions over manual processes
- Multi-hour booking capability is essential
- Smart lock integration for seamless access control

## API Integrations
- TTLock API for smart lock management
- Booking system generates temporary access codes
- Access codes are time-limited to booking duration