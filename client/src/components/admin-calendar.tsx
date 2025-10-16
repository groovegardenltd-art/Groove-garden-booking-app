import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, MapPin, CreditCard, Phone, Mail, User, Pencil, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface BlockedSlot {
  id: number;
  roomId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdBy: number;
  createdAt: string;
  isRecurring: boolean;
  recurringUntil: string | null;
  parentBlockId: number | null;
}

interface AdminCalendarProps {
  bookings: AdminBooking[];
  blockedSlots: BlockedSlot[];
}

interface BookingsByDate {
  [date: string]: AdminBooking[];
}

interface DayBookingCounts {
  [roomName: string]: number;
}

interface BlockedSlotsByDate {
  [date: string]: BlockedSlot[];
}

export function AdminCalendar({ bookings, blockedSlots }: AdminCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<AdminBooking | null>(null);
  const { toast } = useToast();

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return await apiRequest(`/api/admin/bookings/${bookingId}/cancel`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Success",
        description: "Booking cancelled successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive"
      });
    }
  });

  // Get current month/year for display
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Navigation functions - use noon to avoid timezone issues
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1, 12, 0, 0));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1, 12, 0, 0));
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

  // Group blocked slots by date
  const blockedSlotsByDate: BlockedSlotsByDate = blockedSlots.reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(slot);
    return acc;
  }, {} as BlockedSlotsByDate);

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

  // Get days in current month - use noon to avoid timezone issues
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0, 12, 0, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1, 12, 0, 0).getDay();

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
    // Use noon to avoid timezone issues
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
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
    <>
      <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <span className="hidden sm:inline">Bookings Calendar</span>
            <span className="sm:hidden">Calendar</span>
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              data-testid="button-prev-month"
              className="px-2 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-2 sm:px-4 text-sm sm:text-base min-w-0 text-center" data-testid="text-month-year">
              {monthYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              data-testid="button-next-month"
              className="px-2 sm:px-3"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 overflow-hidden">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={index} className="p-1 sm:p-2 h-16 sm:h-20 lg:h-24"></div>;
            }

            const dateStr = formatDate(day);
            const bookingCounts = getBookingCounts(dateStr);
            const totalBookings = Object.values(bookingCounts).reduce((sum, count) => sum + count, 0);
            const hasBookings = totalBookings > 0;
            
            const dayBlockedSlots = blockedSlotsByDate[dateStr] || [];
            const hasBlockedSlots = dayBlockedSlots.length > 0;
            
            // Get today's date in local timezone (YYYY-MM-DD format)
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate === dateStr;

            return (
              <Dialog key={`${currentYear}-${currentMonth}-${day}`}>
                <DialogTrigger asChild>
                  <button
                    className={`p-1 sm:p-2 h-20 sm:h-24 border rounded-lg text-left transition-colors hover:bg-gray-50 ${
                      isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    } ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedDate(dateStr)}
                    data-testid={`calendar-day-${day}`}
                  >
                    <div className="font-medium text-xs sm:text-sm truncate">{day}</div>
                    {(hasBookings || hasBlockedSlots) && (
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {hasBookings && (
                          <div className="text-xs sm:text-xs text-gray-600 truncate">
                            {totalBookings}{totalBookings > 9 ? '+' : ''} 
                            <span className="hidden sm:inline">
                              {' booking'}
                              {totalBookings !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {hasBlockedSlots && (
                          <div className="text-xs sm:text-xs text-red-600 truncate">
                            {dayBlockedSlots.length}{dayBlockedSlots.length > 9 ? '+' : ''} 
                            <span className="hidden sm:inline">
                              {' blocked'}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-0.5 sm:gap-1">
                          {/* Booking indicators */}
                          {Object.entries(bookingCounts).map(([roomName, count]) => (
                            <div
                              key={`booking-${roomName}`}
                              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${getRoomColor(roomName)}`}
                              title={`${roomName}: ${count} booking${count !== 1 ? 's' : ''}`}
                            />
                          ))}
                          {/* Blocked slot indicators */}
                          {hasBlockedSlots && (
                            <div
                              className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 transform rotate-45"
                              title={`${dayBlockedSlots.length} blocked time${dayBlockedSlots.length !== 1 ? 's' : ''}`}
                            />
                          )}
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
                    {/* Show blocked slots first */}
                    {blockedSlotsByDate[dateStr] && blockedSlotsByDate[dateStr].length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-red-600 font-medium">
                          <div className="w-3 h-3 bg-red-500 transform rotate-45"></div>
                          <h3 className="text-lg">Blocked Time Slots</h3>
                        </div>
                        {blockedSlotsByDate[dateStr].map((blockedSlot) => (
                          <div key={`blocked-${blockedSlot.id}`} className="border rounded-lg p-4 bg-red-50 border-red-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-red-500" />
                                  <span className="font-medium">Room ID: {blockedSlot.roomId}</span>
                                  <Badge variant="destructive">Blocked</Badge>
                                </div>
                                <div className="text-sm text-gray-600">
                                  <div>{blockedSlot.startTime} - {blockedSlot.endTime}</div>
                                  {blockedSlot.reason && (
                                    <div className="mt-1 text-red-700">Reason: {blockedSlot.reason}</div>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                {blockedSlot.isRecurring && (
                                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                    Recurring
                                    {blockedSlot.recurringUntil && ` until ${blockedSlot.recurringUntil}`}
                                  </Badge>
                                )}
                                <div className="text-xs text-gray-500">
                                  <div>Block ID: #{blockedSlot.id}</div>
                                  <div>Created: {formatDateTime(blockedSlot.createdAt)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Show bookings */}
                    {bookingsByDate[dateStr] && bookingsByDate[dateStr].length > 0 && (
                      <div className="space-y-4">
                        {blockedSlotsByDate[dateStr] && blockedSlotsByDate[dateStr].length > 0 && (
                          <div className="flex items-center gap-2 text-blue-600 font-medium mt-6">
                            <Calendar className="h-4 w-4" />
                            <h3 className="text-lg">Bookings</h3>
                          </div>
                        )}
                        {bookingsByDate[dateStr].map((booking) => (
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
                              
                              {/* Admin Actions */}
                              <div className="flex gap-2 mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingBooking(booking)}
                                  disabled={booking.status === "cancelled"}
                                  data-testid={`button-edit-booking-${booking.id}`}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={booking.status === "cancelled" || cancelBookingMutation.isPending}
                                      data-testid={`button-cancel-booking-${booking.id}`}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to cancel this booking for {booking.userName}?
                                        This will delete the access code and cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>No, Keep Booking</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => cancelBookingMutation.mutate(booking.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Yes, Cancel Booking
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                    )}

                    {/* Show "no data" message if neither bookings nor blocked slots exist */}
                    {(!bookingsByDate[dateStr] || bookingsByDate[dateStr].length === 0) && 
                     (!blockedSlotsByDate[dateStr] || blockedSlotsByDate[dateStr].length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No bookings or blocked times for this date</p>
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
          <span className="text-gray-600">Indicators:</span>
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
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 transform rotate-45"></div>
            <span>Blocked Times</span>
          </div>
        </div>
      </CardContent>
      </Card>

      {/* Edit Booking Dialog */}
      {editingBooking && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditingBooking(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Booking #{editingBooking.id}</DialogTitle>
            </DialogHeader>
            <EditBookingForm
              booking={editingBooking}
              onClose={() => setEditingBooking(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Edit Booking Form Component
interface EditBookingFormProps {
  booking: AdminBooking;
  onClose: () => void;
}

function EditBookingForm({ booking, onClose }: EditBookingFormProps) {
  const [date, setDate] = useState(booking.date);
  const [startTime, setStartTime] = useState(booking.startTime);
  const [duration, setDuration] = useState(booking.duration);
  const { toast } = useToast();

  // Calculate end time based on start time and duration
  const calculateEndTime = (start: string, hours: number): string => {
    const [startHour, startMin] = start.split(':').map(Number);
    const endMinutes = startHour * 60 + startMin + hours * 60;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  };

  const endTime = calculateEndTime(startTime, duration);

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: async (data: { date: string; startTime: string; endTime: string; duration: number }) => {
      return await apiRequest(`/api/admin/bookings/${booking.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Success",
        description: "Booking updated successfully"
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBookingMutation.mutate({
      date,
      startTime,
      endTime,
      duration
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">User</label>
          <input
            type="text"
            value={booking.userName}
            disabled
            className="w-full px-3 py-2 border rounded-md bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Room</label>
          <input
            type="text"
            value={booking.roomName}
            disabled
            className="w-full px-3 py-2 border rounded-md bg-gray-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          required
          data-testid="input-edit-booking-date"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
            data-testid="input-edit-booking-start-time"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Duration (hours)</label>
          <input
            type="number"
            min="1"
            max="12"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md"
            required
            data-testid="input-edit-booking-duration"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">End Time (calculated)</label>
        <input
          type="text"
          value={endTime}
          disabled
          className="w-full px-3 py-2 border rounded-md bg-gray-50"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateBookingMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={updateBookingMutation.isPending}
          data-testid="button-save-booking-changes"
        >
          {updateBookingMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}