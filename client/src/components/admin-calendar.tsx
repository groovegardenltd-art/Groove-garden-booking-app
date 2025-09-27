import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, MapPin, CreditCard, Phone, Mail, User } from "lucide-react";

interface AdminBooking {
  id: number;
  userId: number;
  roomId: number;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  status: string;
  accessCode: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  roomName: string;
  idVerificationStatus: string;
  createdAt: string;
  contactPhone?: string;
  lockAccessEnabled: boolean;
}

interface AdminCalendarProps {
  bookings: AdminBooking[];
}

interface BookingsByDate {
  [date: string]: AdminBooking[];
}

interface DayBookingCounts {
  [roomName: string]: number;
}

export function AdminCalendar({ bookings }: AdminCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get current month/year for display
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Group bookings by date
  const bookingsByDate: BookingsByDate = bookings.reduce((acc, booking) => {
    const date = booking.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(booking);
    return acc;
  }, {} as BookingsByDate);

  // Calculate booking counts by room for each date
  const getBookingCounts = (date: string): DayBookingCounts => {
    const dayBookings = bookingsByDate[date] || [];
    return dayBookings.reduce((counts, booking) => {
      const roomName = booking.roomName;
      counts[roomName] = (counts[roomName] || 0) + 1;
      return counts;
    }, {} as DayBookingCounts);
  };

  // Get room color for indicators
  const getRoomColor = (roomName: string): string => {
    switch (roomName) {
      case "Pod 1":
        return "bg-blue-500";
      case "Pod 2":
        return "bg-green-500";
      case "Live Room":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  // Format month/year for display
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthYear = `${monthNames[currentMonth]} ${currentYear}`;

  // Get days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Format date for comparison
  const formatDate = (day: number): string => {
    const year = currentYear;
    const month = (currentMonth + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  // Format display functions
  const formatBookingDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateTimeStr: string) => {
    return new Date(dateTimeStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "confirmed":
        return <Badge className="bg-music-amber text-white">Upcoming</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">⏳ Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">✗ Rejected</Badge>;
      default:
        return <Badge variant="secondary">Not submitted</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Bookings Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-4" data-testid="text-month-year">
              {monthYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={index} className="p-2 h-24"></div>;
            }

            const dateStr = formatDate(day);
            const bookingCounts = getBookingCounts(dateStr);
            const totalBookings = Object.values(bookingCounts).reduce((sum, count) => sum + count, 0);
            const hasBookings = totalBookings > 0;
            
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isSelected = selectedDate === dateStr;

            return (
              <Dialog key={day}>
                <DialogTrigger asChild>
                  <button
                    className={`p-2 h-24 border rounded-lg text-left transition-colors hover:bg-gray-50 ${
                      isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    } ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedDate(dateStr)}
                    data-testid={`calendar-day-${day}`}
                  >
                    <div className="font-medium text-sm">{day}</div>
                    {hasBookings && (
                      <div className="mt-1 space-y-1">
                        <div className="text-xs text-gray-600">
                          {totalBookings} booking{totalBookings !== 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(bookingCounts).map(([roomName, count]) => (
                            <div
                              key={roomName}
                              className={`w-2 h-2 rounded-full ${getRoomColor(roomName)}`}
                              title={`${roomName}: ${count} booking${count !== 1 ? 's' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Bookings for {formatBookingDate(dateStr)}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {bookingsByDate[dateStr] ? (
                      bookingsByDate[dateStr].map((booking) => (
                        <div key={booking.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Left Column - User & Booking Info */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{booking.userName}</span>
                                {getVerificationBadge(booking.idVerificationStatus)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="h-4 w-4" />
                                <span>{booking.userEmail}</span>
                              </div>
                              {booking.userPhone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="h-4 w-4" />
                                  <span>{booking.userPhone}</span>
                                </div>
                              )}
                            </div>

                            {/* Middle Column - Booking Details */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{booking.roomName}</span>
                                {getStatusBadge(booking.status)}
                              </div>
                              <div className="text-sm text-gray-600">
                                <div>{booking.startTime} - {booking.endTime} ({booking.duration}h)</div>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <CreditCard className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-green-600">£{booking.totalPrice.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Right Column - Access & Details */}
                            <div className="space-y-2">
                              <div className="text-sm">
                                <div className="text-gray-600">Access Code:</div>
                                <div className="font-mono bg-white px-2 py-1 rounded border text-music-purple">
                                  {booking.accessCode}#
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                <div>Lock Access: {booking.lockAccessEnabled ? "✅ Enabled" : "❌ Disabled"}</div>
                                <div>Booked: {formatDateTime(booking.createdAt)}</div>
                                <div>ID: #{booking.id}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No bookings for this date</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-600">Room indicators:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Pod 1</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Pod 2</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Live Room</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}