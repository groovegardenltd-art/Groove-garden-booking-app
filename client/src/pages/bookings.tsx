import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Calendar, Clock, MapPin } from "lucide-react";
import { BookingWithRoom } from "@shared/schema";
import { getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";

export default function Bookings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check authentication
  const { user } = getAuthState();
  
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  // Fetch user bookings
  const { data: bookings = [], isLoading } = useQuery<BookingWithRoom[]>({
    queryKey: ["/api/bookings", user?.id],
    enabled: !!user,
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest("PATCH", `/api/bookings/${bookingId}/cancel`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", user?.id] });
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Access Code Copied!",
      description: "The access code has been copied to your clipboard.",
    });
  };

  const handleCancelBooking = (bookingId: number) => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      cancelMutation.mutate(bookingId);
    }
  };

  const formatDate = (dateStr: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

  const isUpcoming = (booking: BookingWithRoom) => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
    return bookingDateTime > new Date() && booking.status === "confirmed";
  };

  const groupBookingsByStatus = (bookings: BookingWithRoom[]) => {
    const upcoming = bookings.filter(booking => isUpcoming(booking));
    const past = bookings.filter(booking => !isUpcoming(booking) || booking.status !== "confirmed");
    
    return { upcoming, past };
  };

  if (!user) {
    return null; // Will redirect to login
  }

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
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h2>
          <p className="text-gray-600">
            Manage your rehearsal room bookings and access codes.
          </p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
              <p className="text-gray-600 mb-4">
                You haven't made any bookings yet. Start by booking your first rehearsal room.
              </p>
              <Button 
                className="bg-music-purple hover:bg-music-purple/90"
                onClick={() => setLocation("/")}
              >
                Book a Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Bookings */}
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
                          {/* Front Door Code */}
                          <div className="bg-white rounded-lg p-3 border">
                            <div className="text-sm font-medium text-gray-900 mb-2">Front Door Code</div>
                            <div className="flex items-center justify-between">
                              <code className="bg-music-indigo text-white px-3 py-1 rounded text-lg font-mono">
                                {booking.accessCode}#
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyAccessCode(booking.accessCode)}
                                className="text-music-indigo hover:text-music-purple"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Interior Door Code */}
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-sm font-medium text-gray-900 mb-2">{booking.room.name} Interior Code</div>
                            <div className="flex items-center justify-between">
                              <code className="bg-green-600 text-white px-3 py-1 rounded text-lg font-mono">
                                {booking.room.name === 'Live Room' ? '5234' : 
                                 booking.room.name === 'Pod 1' ? '2369' : 
                                 booking.room.name === 'Pod 2' ? '3542' : 'N/A'}#
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const interiorCode = booking.room.name === 'Live Room' ? '5234' : 
                                                     booking.room.name === 'Pod 1' ? '2369' : 
                                                     booking.room.name === 'Pod 2' ? '3542' : 'N/A';
                                  copyAccessCode(interiorCode);
                                }}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-music-purple">
                              £{booking.totalPrice}
                            </span>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Past Bookings */}
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
                              <h4 className="text-lg font-medium text-gray-900">
                                {booking.room.name}
                              </h4>
                              {getStatusBadge(booking.status)}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-2" />
                                {formatDate(booking.date)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-2" />
                                {formatTime(booking.startTime, booking.endTime)}
                              </div>

                              <div className="font-semibold text-music-purple">
                                £{booking.totalPrice}
                              </div>
                            </div>
                            {booking.specialRequests && (
                              <div className="mt-2 text-sm text-gray-600">
                                <strong>Special Requests:</strong> {booking.specialRequests}
                              </div>
                            )}
                          </div>
                          {booking.status !== "cancelled" && (
                            <div className="ml-4 flex flex-col space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Front:</span>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                  {booking.accessCode}#
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
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Interior:</span>
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono">
                                  {booking.room.name === 'Live Room' ? '5234' : 
                                   booking.room.name === 'Pod 1' ? '2369' : 
                                   booking.room.name === 'Pod 2' ? '3542' : 'N/A'}#
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const interiorCode = booking.room.name === 'Live Room' ? '5234' : 
                                                       booking.room.name === 'Pod 1' ? '2369' : 
                                                       booking.room.name === 'Pod 2' ? '3542' : 'N/A';
                                    copyAccessCode(interiorCode);
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
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
    </div>
  );
}
