import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingModal } from "@/components/booking-modal";
import { getAuthState } from "@/lib/auth";
import { Link } from "wouter";
import { Calendar, Clock, Music, ChevronLeft } from "lucide-react";

interface GroupInfo {
  code: string;
  groupName: string;
  roomIds: number[];
  dates: string[];
  windows: Array<{
    date: string;
    roomId: number;
    startTime: string;
    endTime: string;
  }>;
}

interface Room {
  id: number;
  name: string;
  description: string;
  pricePerHour: string;
  dayPricePerHour?: string;
  eveningPricePerHour?: string;
  capacity?: number;
}

interface AvailabilityData {
  date: string;
  bookedSlots: Array<{ startTime: string; endTime: string }>;
}

export default function GroupBooking() {
  const params = useParams<{ groupCode: string }>();
  const groupCode = params.groupCode;
  const [, setLocation] = useLocation();
  const { user } = getAuthState();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [autoRoomSelected, setAutoRoomSelected] = useState(false);

  const { data: groupInfo, isLoading: groupLoading, error: groupError } = useQuery<GroupInfo>({
    queryKey: ["/api/group", groupCode],
    queryFn: async () => {
      const res = await fetch(`/api/group/${groupCode}`);
      if (!res.ok) throw new Error("Group not found");
      return res.json();
    },
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: availabilityData } = useQuery<AvailabilityData>({
    queryKey: ["/api/rooms/availability", selectedDate, selectedRoom?.id, groupCode],
    queryFn: async () => {
      if (!selectedDate || !selectedRoom) return null;
      const res = await fetch(`/api/rooms/${selectedRoom.id}/availability?date=${selectedDate}&groupCode=${groupCode}`);
      if (!res.ok) throw new Error("Failed to load availability");
      return res.json();
    },
    enabled: !!selectedDate && !!selectedRoom,
  });

  if (groupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">Loading your booking page...</p>
        </div>
      </div>
    );
  }

  if (groupError || !groupInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Link Not Found</h2>
            <p className="text-gray-600">This booking link is invalid or has expired. Please contact your organisation for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <Music className="h-8 w-8 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Sign In Required</h2>
            <p className="text-gray-600">You need to be signed in to book a rehearsal slot. Your access code is <strong>{groupCode}</strong>.</p>
            <Button
              className="bg-purple-600 hover:bg-purple-700 w-full"
              onClick={() => setLocation(`/login?redirect=/book/${groupCode}`)}
            >
              Sign In to Continue
            </Button>
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <Link href="/login" className="text-purple-600 hover:underline">Register here</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Booking Confirmed!</h2>
            <p className="text-gray-600">
              Your rehearsal slot is booked for <strong>{bookingSuccess.date}</strong> at <strong>{bookingSuccess.startTime}</strong>.
            </p>
            {bookingSuccess.accessCode && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-700 font-medium">Door Access Code</p>
                <p className="text-2xl font-bold text-purple-900 tracking-widest">{bookingSuccess.accessCode}</p>
                <p className="text-xs text-purple-600 mt-1">Enter this code on the keypad</p>
              </div>
            )}
            <p className="text-sm text-gray-500">A confirmation email has been sent to your email address.</p>
            <Button variant="outline" className="w-full" onClick={() => setBookingSuccess(null)}>
              Book Another Slot
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get windows for the selected date
  const dateWindows = selectedDate
    ? groupInfo.windows.filter(w => w.date === selectedDate)
    : [];

  // Build available hourly slots within the reserved windows
  const getAvailableSlots = () => {
    if (!selectedDate || !selectedRoom || !availabilityData) return [];

    const bookedTimes = availabilityData.bookedSlots;
    const windowsForRoom = dateWindows.filter(w => w.roomId === selectedRoom.id);

    if (windowsForRoom.length === 0) return [];

    const slots: string[] = [];

    for (const window of windowsForRoom) {
      const startHour = parseInt(window.startTime.split(":")[0]);
      const endHour = parseInt(window.endTime.split(":")[0]);

      for (let h = startHour; h < endHour; h++) {
        const slotTime = `${String(h).padStart(2, "0")}:00`;
        const slotEnd = `${String(h + 1).padStart(2, "0")}:00`;

        const isBooked = bookedTimes.some(b => b.startTime <= slotTime && b.endTime > slotTime);
        if (!isBooked) {
          slots.push(slotTime);
        }
      }
    }

    return slots;
  };

  const availableSlots = getAvailableSlots();

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const formatTime = (t: string) => {
    const h = parseInt(t.split(":")[0]);
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  const groupRooms = rooms?.filter(r => groupInfo.roomIds.includes(r.id)) || [];

  // Auto-select if only one room
  useEffect(() => {
    if (!autoRoomSelected && groupRooms.length === 1 && !selectedRoom) {
      setSelectedRoom(groupRooms[0]);
      setAutoRoomSelected(true);
    }
  }, [groupRooms.length, autoRoomSelected, selectedRoom]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Groove Garden Studios</h1>
            <p className="text-sm text-gray-500">{groupInfo.groupName}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome card */}
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Book Your Rehearsal Slot</h2>
              <p className="text-gray-600 text-sm">
                Select a date and time from your organisation's reserved windows.
                Bookings are free — covered by <strong>{groupInfo.groupName}</strong>.
              </p>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {groupInfo.dates.length} session{groupInfo.dates.length !== 1 ? "s" : ""} available
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Room (if multiple) */}
        {groupRooms.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Step 1: Select a Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => { setSelectedRoom(room); setSelectedDate(null); setSelectedTime(null); }}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${
                    selectedRoom?.id === room.id
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-gray-900">{room.name}</div>
                  {room.description && <div className="text-sm text-gray-500">{room.description}</div>}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date */}
        {(selectedRoom || groupRooms.length === 1) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {groupRooms.length > 1 ? "Step 2: Select a Date" : "Step 1: Select a Date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groupInfo.dates.length === 0 ? (
                <p className="text-gray-500 text-sm">No dates available for this group booking.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupInfo.dates.map(date => {
                    const roomToCheck = selectedRoom || groupRooms[0];
                    const hasWindowForRoom = groupInfo.windows.some(w => w.date === date && w.roomId === roomToCheck?.id);
                    if (!hasWindowForRoom) return null;
                    return (
                      <button
                        key={date}
                        onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          selectedDate === date
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-900">{formatDate(date)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Time slot */}
        {selectedDate && (selectedRoom || groupRooms.length === 1) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {groupRooms.length > 1 ? "Step 3: Select a Time" : "Step 2: Select a Time"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!availabilityData ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                  Loading available slots...
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No available slots for this date. All slots may already be booked.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableSlots.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`p-3 border rounded-lg text-center transition-colors ${
                        selectedTime === time
                          ? "border-purple-500 bg-purple-50 text-purple-700 font-medium"
                          : "border-gray-200 hover:border-purple-300 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <Clock className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                      <span className="text-sm">{formatTime(time)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Book button */}
        {selectedTime && (
          <div className="sticky bottom-4">
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base shadow-lg"
              onClick={() => setBookingModalOpen(true)}
            >
              Book {formatTime(selectedTime)} on {selectedDate ? formatDate(selectedDate) : ""} — Free
            </Button>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedRoom && (
        <BookingModal
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          selectedRoom={selectedRoom || groupRooms[0] || null}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedDuration={1}
          isFreeGroupBooking={true}
          groupCode={groupCode}
          onBookingSuccess={(booking) => {
            setBookingModalOpen(false);
            setBookingSuccess(booking);
          }}
        />
      )}
    </div>
  );
}
