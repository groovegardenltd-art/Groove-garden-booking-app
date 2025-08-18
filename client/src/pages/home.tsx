import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { RoomSelection } from "@/components/room-selection";
import { BookingCalendar } from "@/components/booking-calendar";
import { BookingModal } from "@/components/booking-modal";
import { SuccessModal } from "@/components/success-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { Room, BookingWithRoom } from "@shared/schema";
import { getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import grooveGardenLogo from "@assets/groove-garden-logo.jpeg";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successBooking, setSuccessBooking] = useState<any>(null);

  // Check authentication
  const { user } = getAuthState();
  
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  // Fetch rooms
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    enabled: !!user,
  });

  // Fetch user bookings
  const { data: userBookings = [], isLoading: bookingsLoading } = useQuery<BookingWithRoom[]>({
    queryKey: ["/api/bookings"],
    enabled: !!user,
  });

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setSelectedTime(null); // Reset time selection when room changes
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null); // Reset time selection when date changes
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const calculatePrice = (duration: number, startTime: string = "09:00") => {
    if (!selectedRoom) return 0;

    // Check if room has time-based pricing
    const room = selectedRoom as any;
    if (room.dayPricePerHour && room.eveningPricePerHour) {
      return calculateTimeBasedPrice(room, startTime, duration);
    }
    
    // For rooms without time-based pricing, use standard hourly rate
    return duration * parseFloat(room.pricePerHour || "40");
  };

  const calculateTimeBasedPrice = (room: any, startTime: string, duration: number) => {
    const dayPrice = parseFloat(room.dayPricePerHour || "8");
    const eveningPrice = parseFloat(room.eveningPricePerHour || "10");
    const dayStart = room.dayHoursStart || "06:00";
    const dayEnd = room.dayHoursEnd || "17:00";
    
    const [startHour] = startTime.split(':').map(Number);
    const [dayStartHour] = dayStart.split(':').map(Number);
    const [dayEndHour] = dayEnd.split(':').map(Number);
    
    let totalPrice = 0;
    
    // Calculate hour by hour
    for (let hour = startHour; hour < startHour + duration; hour++) {
      if (hour >= dayStartHour && hour < dayEndHour) {
        totalPrice += dayPrice; // Day rate
      } else {
        totalPrice += eveningPrice; // Evening rate
      }
    }
    
    return totalPrice;
  };

  const handleBookingSuccess = (booking: any) => {
    // Find the room details to include in the success modal
    const room = rooms.find((r: Room) => r.id === booking.roomId);
    setSuccessBooking({ ...booking, room });
    setShowSuccessModal(true);
    
    // Reset selections
    setSelectedRoom(null);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const openBookingModal = () => {
    if (!selectedRoom || !selectedDate || !selectedTime) {
      toast({
        title: "Incomplete Selection",
        description: "Please select a room, date, and time slot.",
        variant: "destructive",
      });
      return;
    }
    setShowBookingModal(true);
  };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Access Code Copied!",
      description: "The access code has been copied to your clipboard.",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (startTime: string, endTime: string) => {
    const formatSingleTime = (timeStr: string) => {
      const [hours, minutes = '00'] = timeStr.split(':');
      const hour = parseInt(hours);
      const minute = parseInt(minutes);
      
      if (hour === 0) return `12:${minute.toString().padStart(2, '0')} AM`;
      if (hour < 12) return `${hour}:${minute.toString().padStart(2, '0')} AM`;
      if (hour === 12) return `12:${minute.toString().padStart(2, '0')} PM`;
      return `${hour - 12}:${minute.toString().padStart(2, '0')} PM`;
    };

    return `${formatSingleTime(startTime)} - ${formatSingleTime(endTime)}`;
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

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <img 
              src={grooveGardenLogo} 
              alt="Groove Garden Studio" 
              className="w-16 h-16 rounded-lg object-cover mr-4 shadow-md"
            />
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">Book Your Rehearsal Space</h2>
              <p className="text-lg text-green-600 font-medium">Groove Garden Studios</p>
            </div>
          </div>
          <p className="text-gray-600">
            Choose from our professional-grade rehearsal rooms equipped with top-tier audio equipment.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Selection Sidebar */}
          <div className="lg:col-span-1">
            <RoomSelection
              rooms={rooms}
              selectedRoom={selectedRoom}
              onRoomSelect={handleRoomSelect}
            />
          </div>

          {/* Calendar and Booking Section */}
          <div className="lg:col-span-2">
            <BookingCalendar
              selectedRoom={selectedRoom}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              selectedDuration={selectedDuration}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
              onDurationChange={setSelectedDuration}
            />

            {/* Booking Summary */}
            {selectedRoom && selectedDate && selectedTime && (
              <div className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="bg-music-indigo/5 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Booking Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Room:</span>
                          <span className="font-medium">{selectedRoom.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date:</span>
                          <span className="font-medium">
                            {(() => {
                              const [year, month, day] = selectedDate.split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                              return date.toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Time:</span>
                          <span className="font-medium">
                            {formatTime(selectedTime, `${String(parseInt(selectedTime.split(':')[0]) + selectedDuration).padStart(2, '0')}:00`)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{selectedDuration} hour{selectedDuration > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold text-music-purple text-lg">
                            £{calculatePrice(selectedDuration, selectedTime || "09:00").toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full bg-music-purple text-white font-medium py-3 px-4 rounded-lg hover:bg-music-purple/90 transition-colors mt-4"
                        onClick={openBookingModal}
                      >
                        Continue to Booking
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Recent Bookings Section */}
        <div className="mt-12">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Your Recent Bookings</h3>
                <Button 
                  variant="ghost" 
                  className="text-music-indigo font-medium text-sm hover:text-music-purple"
                  onClick={() => setLocation("/bookings")}
                >
                  View All
                </Button>
              </div>

              {bookingsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading bookings...</div>
              ) : userBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No bookings yet. Make your first booking above!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Room</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Date & Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Access Code</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userBookings.slice(0, 3).map((booking: BookingWithRoom) => (
                        <tr key={booking.id}>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{booking.room.name}</div>
                            <div className="text-sm text-gray-500">{booking.room.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{formatDate(booking.date)}</div>
                            <div className="text-sm text-gray-500">
                              {formatTime(booking.startTime, booking.endTime)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(booking.status)}
                          </td>
                          <td className="py-3 px-4">
                            {booking.status !== "cancelled" && (
                              <div className="flex items-center space-x-2">
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                  {booking.accessCode}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyAccessCode(booking.accessCode)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-music-indigo hover:text-music-purple text-sm font-medium"
                              onClick={() => setLocation("/bookings")}
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modals */}
      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        selectedRoom={selectedRoom}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        selectedDuration={selectedDuration}
        onBookingSuccess={handleBookingSuccess}
      />

      <SuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        booking={successBooking}
        onViewDetails={() => setLocation("/bookings")}
      />
    </div>
  );
}
