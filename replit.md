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
- **Jun 27, 2025**: Changed currency from dollars to pounds with new pricing structure (1hr-£40, 2hrs-£75, 3hrs-£105, 4hrs-£135)
- **Jun 27, 2025**: Completed TTLock smart lock integration with automatic passcode generation for booking time slots
- **Jun 27, 2025**: Added smart lock management interface with setup guide and connection testing
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