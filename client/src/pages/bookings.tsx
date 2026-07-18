import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, Calendar, Clock, MapPin, Trash2, Pencil, AlertCircle } from "lucide-react";
import { BookingWithRoom, Room } from "@shared/schema";
import { getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Bookings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user } = getAuthState();

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  // Edit dialog state
  const [editingBooking, setEditingBooking] = useState<BookingWithRoom | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const { data: bookings = [], isLoading } = useQuery<BookingWithRoom[]>({
    queryKey: ["/api/bookings", user?.id],
    enabled: !!user,
  });

  // Fetch availability for the edit dialog date
  const { data: editAvailability } = useQuery<{ date: string; bookedSlots: { startTime: string; endTime: string }[] }>({
    queryKey: ["/api/rooms", editingBooking?.roomId, "availability", editDate],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${editingBooking!.roomId}/availability?date=${editDate}`);
      return res.json();
    },
    enabled: !!editingBooking && !!editDate,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest("PATCH", `/api/bookings/${bookingId}/cancel`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", user?.id] });
      toast({ title: "Booking Cancelled", description: "Your booking has been cancelled successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Cancellation Failed", description: error.message || "Failed to cancel booking. Please try again.", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest("DELETE", `/api/bookings/${bookingId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", user?.id] });
      toast({ title: "Booking Removed", description: "The booking has been removed from your history." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Remove", description: error.message || "Could not remove this booking.", variant: "destructive" });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ bookingId, date, startTime, endTime }: { bookingId: number; date: string; startTime: string; endTime: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${bookingId}`, { date, startTime, endTime });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", user?.id] });
      setEditingBooking(null);
      toast({ title: "Booking Updated", description: data.message || "Your booking time has been updated." });
    },
    onError: (error: any) => {
      let description = "Failed to update booking.";
      if (error?.message) {
        const match = error.message.match(/^\d+:\s*(.+)$/s);
        const body = match ? match[1] : error.message;
        try { const p = JSON.parse(body); if (p?.message) description = p.message; } catch { if (body) description = body; }
      }
      toast({ title: "Update Failed", description, variant: "destructive" });
    },
  });

  const handleCancelBooking = (bookingId: number) => {
    if (confirm("Are you sure you want to cancel this booking?")) cancelMutation.mutate(bookingId);
  };

  const handleDeleteBooking = (bookingId: number) => {
    if (confirm("Remove this booking from your history? This cannot be undone.")) deleteMutation.mutate(bookingId);
  };

  const handleOpenEdit = (booking: BookingWithRoom) => {
    setEditingBooking(booking);
    setEditDate(booking.date);
    setEditStartTime(booking.startTime);
    setEditEndTime(booking.endTime);
  };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Access Code Copied!", description: "The access code has been copied to your clipboard." });
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (startTime: string, endTime: string) => {
    const fmt = (t: string) => {
      const [hours, minutes = '00'] = t.split(':');
      const h = parseInt(hours); const m = parseInt(minutes);
      if (h === 0) return `12:${String(m).padStart(2, '0')} AM`;
      if (h < 12) return `${h}:${String(m).padStart(2, '0')} AM`;
      if (h === 12) return `12:${String(m).padStart(2, '0')} PM`;
      if (h === 24) return `12:00 AM`;
      return `${h - 12}:${String(m).padStart(2, '0')} PM`;
    };
    return `${fmt(startTime)} – ${fmt(endTime)}`;
  };

  const formatHour = (h: number) => {
    if (h === 0 || h === 24) return "12:00 AM (midnight)";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM (noon)";
    return `${h - 12}:00 PM`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "confirmed": return <Badge className="bg-music-amber text-white">Upcoming</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isUpcoming = (booking: BookingWithRoom) => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
    return bookingDateTime > new Date() && booking.status === "confirmed";
  };

  const groupBookingsByStatus = (bookings: BookingWithRoom[]) => {
    const upcoming = bookings.filter(isUpcoming);
    const past = bookings.filter(b => !isUpcoming(b) || b.status !== "confirmed");
    return { upcoming, past };
  };

  // ── Edit dialog helpers ──────────────────────────────────────
  const STUDIO_OPEN = 9;
  const STUDIO_CLOSE = 24;

  // Client-side price calculation matching server logic
  const calcNewPrice = (room: Room, startTime: string, endTime: string): number => {
    const startH = parseInt(startTime.split(':')[0]);
    const endH = endTime === '00:00' ? 24 : parseInt(endTime.split(':')[0]);
    const dur = endH - startH;
    if (dur <= 0) return 0;
    if (room.dayPricePerHour && room.eveningPricePerHour) {
      const dayStartH = parseInt((room.dayHoursStart || '09:00').split(':')[0]);
      const dayEndH = parseInt((room.dayHoursEnd || '17:00').split(':')[0]);
      const dayRate = parseFloat(room.dayPricePerHour);
      const eveningRate = parseFloat(room.eveningPricePerHour);
      let total = 0;
      for (let h = startH; h < endH; h++) total += (h >= dayStartH && h < dayEndH) ? dayRate : eveningRate;
      return dur > 4 ? total * 0.9 : total;
    }
    const base = parseFloat(room.pricePerHour || '40');
    return dur > 4 ? dur * base * 0.9 : dur * base;
  };

  // Booked slots for the edit date, excluding the booking being edited
  const rawBookedSlots = editAvailability?.bookedSlots ?? [];
  const bookedSlotsForEdit = rawBookedSlots.filter(slot => {
    if (!editingBooking || editDate !== editingBooking.date) return true;
    return !(slot.startTime === editingBooking.startTime && slot.endTime === editingBooking.endTime);
  });

  const isHourBlocked = (hour: number) => {
    const hStr = `${String(hour).padStart(2, '0')}:00`;
    const hNextStr = `${String(hour + 1).padStart(2, '0')}:00`;
    return bookedSlotsForEdit.some(s => s.startTime < hNextStr && s.endTime > hStr);
  };

  const availableStartHours = Array.from({ length: STUDIO_CLOSE - STUDIO_OPEN - 1 }, (_, i) => STUDIO_OPEN + i)
    .filter(h => !isHourBlocked(h));

  const selectedStartHour = editStartTime ? (editStartTime === '00:00' ? 24 : parseInt(editStartTime.split(':')[0])) : null;
  const availableEndHours = selectedStartHour !== null
    ? Array.from({ length: STUDIO_CLOSE - selectedStartHour }, (_, i) => selectedStartHour + 1 + i).filter(h => {
        for (let hr = selectedStartHour; hr < h; hr++) {
          if (hr > selectedStartHour && isHourBlocked(hr)) return false;
        }
        return h <= STUDIO_CLOSE;
      })
    : [];

  const todayStr = new Date().toISOString().split('T')[0];
  const editDateIsSunday = editDate
    ? new Date(editDate + 'T12:00:00Z').getDay() === 0
    : false;

  const newPrice = editingBooking && editStartTime && editEndTime
    ? calcNewPrice(editingBooking.room, editStartTime, editEndTime)
    : null;
  const priceChanged = newPrice !== null && editingBooking
    ? Math.abs(newPrice - parseFloat(editingBooking.totalPrice)) > 0.01
    : false;

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading your bookings...</div>
          </div>
        </main>
      </div>
    );
  }

  const { upcoming, past } = groupBookingsByStatus(bookings);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h2>
          <p className="text-gray-600">Manage your rehearsal room bookings and access codes.</p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
              <p className="text-gray-600 mb-4">You haven't made any bookings yet. Start by booking your first rehearsal room.</p>
              <Button className="bg-music-purple hover:bg-music-purple/90" onClick={() => setLocation("/")}>
                Book a Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Bookings</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((booking) => (
                    <Card key={booking.id} className="border border-music-indigo/20 bg-music-indigo/5">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{booking.room.name}</CardTitle>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            {formatDate(booking.date)}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Clock className="h-4 w-4 mr-2" />
                            {formatTime(booking.startTime, booking.endTime)}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <MapPin className="h-4 w-4 mr-2" />
                            {booking.room.description}
                          </div>
                        </div>

                        {/* Access Codes */}
                        <div className="space-y-2">
                          <div className="bg-white rounded-lg p-3 border">
                            <div className="text-sm font-medium text-gray-900 mb-2">Front Door Code</div>
                            <div className="flex items-center justify-between">
                              <code className="bg-music-indigo text-white px-3 py-1 rounded text-lg font-mono">
                                {booking.accessCode}#
                              </code>
                              <Button variant="ghost" size="sm" onClick={() => copyAccessCode(booking.accessCode)} className="text-music-indigo hover:text-music-purple">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-sm font-medium text-gray-900 mb-2">{booking.room.name} Interior Code</div>
                            <div className="flex items-center justify-between">
                              <code className="bg-green-600 text-white px-3 py-1 rounded text-lg font-mono">
                                {booking.room.name === 'Live Room' ? '5234' : booking.room.name === 'Pod 1' ? '2369' : booking.room.name === 'Pod 2' ? '3542' : 'N/A'}#
                              </code>
                              <Button variant="ghost" size="sm" onClick={() => { const c = booking.room.name === 'Live Room' ? '5234' : booking.room.name === 'Pod 1' ? '2369' : booking.room.name === 'Pod 2' ? '3542' : 'N/A'; copyAccessCode(c); }} className="text-green-600 hover:text-green-700">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-music-purple">£{booking.totalPrice}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(booking)}
                                className="text-music-purple border-music-purple hover:bg-music-purple/10"
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelBooking(booking.id)}
                                disabled={cancelMutation.isPending}
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Booking History</h3>
                <div className="space-y-4">
                  {past.map((booking) => (
                    <Card key={booking.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-2">
                              <h4 className="text-lg font-medium text-gray-900">{booking.room.name}</h4>
                              {getStatusBadge(booking.status)}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center"><Calendar className="h-4 w-4 mr-2" />{formatDate(booking.date)}</div>
                              <div className="flex items-center"><Clock className="h-4 w-4 mr-2" />{formatTime(booking.startTime, booking.endTime)}</div>
                              <div className="font-semibold text-music-purple">£{booking.totalPrice}</div>
                            </div>
                            {booking.specialRequests && (
                              <div className="mt-2 text-sm text-gray-600"><strong>Special Requests:</strong> {booking.specialRequests}</div>
                            )}
                          </div>
                          <div className="ml-4 flex flex-col items-end space-y-2">
                            {booking.status !== "cancelled" && (
                              <>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">Front:</span>
                                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{booking.accessCode}#</code>
                                  <Button variant="ghost" size="sm" onClick={() => copyAccessCode(booking.accessCode)} className="p-1 text-gray-400 hover:text-gray-600"><Copy className="h-4 w-4" /></Button>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">Interior:</span>
                                  <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono">
                                    {booking.room.name === 'Live Room' ? '5234' : booking.room.name === 'Pod 1' ? '2369' : booking.room.name === 'Pod 2' ? '3542' : 'N/A'}#
                                  </code>
                                  <Button variant="ghost" size="sm" onClick={() => { const c = booking.room.name === 'Live Room' ? '5234' : booking.room.name === 'Pod 1' ? '2369' : booking.room.name === 'Pod 2' ? '3542' : 'N/A'; copyAccessCode(c); }} className="p-1 text-gray-400 hover:text-gray-600"><Copy className="h-4 w-4" /></Button>
                                </div>
                              </>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteBooking(booking.id)} disabled={deleteMutation.isPending} className="p-1 text-gray-400 hover:text-red-500" title="Remove from history">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Edit Booking Dialog */}
      <Dialog open={!!editingBooking} onOpenChange={(open) => { if (!open) setEditingBooking(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Booking — {editingBooking?.room.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current booking summary */}
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border">
              <div className="font-medium text-gray-700 mb-1">Current booking</div>
              <div>{editingBooking ? formatDate(editingBooking.date) : ''}</div>
              <div>{editingBooking ? formatTime(editingBooking.startTime, editingBooking.endTime) : ''}</div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">New Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                min={todayStr}
                onChange={(e) => {
                  setEditDate(e.target.value);
                  setEditStartTime("");
                  setEditEndTime("");
                }}
              />
              {editDateIsSunday && (
                <p className="text-sm text-red-600 font-medium">Studios are closed on Sundays — please choose another day.</p>
              )}
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Select
                value={editStartTime}
                onValueChange={(v) => { setEditStartTime(v); setEditEndTime(""); }}
                disabled={!editDate || editDateIsSunday}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editDate ? "Select start time" : "Choose a date first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableStartHours.length === 0 && (
                    <SelectItem value="__none__" disabled>No slots available</SelectItem>
                  )}
                  {availableStartHours.map(h => (
                    <SelectItem key={h} value={`${String(h).padStart(2, '0')}:00`}>
                      {formatHour(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <Label>End Time</Label>
              <Select
                value={editEndTime}
                onValueChange={setEditEndTime}
                disabled={!editStartTime}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editStartTime ? "Select end time" : "Choose a start time first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableEndHours.length === 0 && (
                    <SelectItem value="__none__" disabled>No slots available</SelectItem>
                  )}
                  {availableEndHours.map(h => (
                    <SelectItem key={h} value={h === 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`}>
                      {formatHour(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price preview */}
            {editStartTime && editEndTime && editingBooking && newPrice !== null && (
              <div className="rounded-lg bg-music-indigo/10 p-3 space-y-1.5 text-sm border border-music-indigo/20">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {(() => {
                      const s = editStartTime === '00:00' ? 24 : parseInt(editStartTime);
                      const e = editEndTime === '00:00' ? 24 : parseInt(editEndTime);
                      return `${e - s} hour${e - s !== 1 ? 's' : ''}`;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">New price:</span>
                  <span className="font-semibold text-music-purple">£{newPrice.toFixed(2)}</span>
                </div>
                {priceChanged && (
                  <div className="flex gap-2 pt-1 text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="text-xs">
                      Price differs from your original booking (£{parseFloat(editingBooking.totalPrice).toFixed(2)}). No automatic payment adjustment — please contact us if a refund or top-up is needed.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingBooking(null)}>
              Keep Original
            </Button>
            <Button
              onClick={() => editMutation.mutate({
                bookingId: editingBooking!.id,
                date: editDate,
                startTime: editStartTime,
                endTime: editEndTime,
              })}
              disabled={!editDate || editDateIsSunday || !editStartTime || !editEndTime || editMutation.isPending}
              className="bg-music-purple hover:bg-music-purple/90"
            >
              {editMutation.isPending ? "Updating…" : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
