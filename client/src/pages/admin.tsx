import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, FileText, Shield, CalendarX, Plus, Trash2, Repeat, Calendar, MapPin, CreditCard, Phone, Mail, List, Grid3X3 } from "lucide-react";
import { AdminCalendar } from "@/components/admin-calendar";
import { getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface PendingUser {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  idType: string;
  idNumber: string;
  idPhotoUrl: string;
  selfiePhotoUrl: string;
  idVerificationStatus: string;
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

interface Room {
  id: number;
  name: string;
  description: string;
}

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

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Check authorization immediately without state to prevent hooks ordering issues
  const { user } = getAuthState();
  const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
  const isAuthorized = user && adminEmails.includes(user.email);

  // ALL hooks must be called unconditionally at the top
  const { data: pendingUsers, isLoading, error } = useQuery({
    queryKey: ["/api/admin/id-verifications"],
    refetchInterval: 30000,
    enabled: !!isAuthorized, // Only run query if authorized
  });

  const { data: blockedSlots, isLoading: blockedSlotsLoading } = useQuery({
    queryKey: ["/api/admin/blocked-slots"],
    enabled: !!isAuthorized,
  });

  const { data: rooms } = useQuery({
    queryKey: ["/api/rooms"],
    enabled: !!isAuthorized,
  });

  const { data: adminBookings, isLoading: bookingsLoading } = useQuery<AdminBooking[]>({
    queryKey: ["/api/admin/bookings"],
    enabled: !!isAuthorized,
    refetchInterval: 60000, // Refresh every minute
  });

  const [blockSlotDialogOpen, setBlockSlotDialogOpen] = useState(false);
  const [bookingsViewMode, setBookingsViewMode] = useState<"calendar" | "list">("calendar");
  const [blockSlotData, setBlockSlotData] = useState({
    roomId: "",
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
    isRecurring: false,
    recurringUntil: "",
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "✅ User Approved",
        description: "User has been verified and can now make bookings.",
      });
    },
    onError: () => {
      toast({
        title: "❌ Approval Failed",
        description: "Failed to approve ID verification. Please try again.",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/reject`, { reason: "ID verification requirements not met" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "❌ User Rejected", 
        description: "User's verification was rejected and future bookings cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "❌ Rejection Failed",
        description: "Failed to reject ID verification. Please try again.",
        variant: "destructive",
      });
    }
  });

  const createBlockedSlotMutation = useMutation({
    mutationFn: (data: typeof blockSlotData) => apiRequest("POST", "/api/admin/blocked-slots", {
      roomId: parseInt(data.roomId),
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason || null,
      isRecurring: data.isRecurring,
      recurringUntil: data.isRecurring ? data.recurringUntil : null,
    }),
    onSuccess: (createdSlots) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-slots"] });
      setBlockSlotDialogOpen(false);
      setBlockSlotData({ roomId: "", date: "", startTime: "", endTime: "", reason: "", isRecurring: false, recurringUntil: "" });
      const count = Array.isArray(createdSlots) ? createdSlots.length : 1;
      toast({
        title: "✅ Time Slot Blocked",
        description: `${count} time slot${count > 1 ? 's' : ''} successfully blocked.`,
      });
    },
    onError: () => {
      toast({
        title: "❌ Failed to Block Slot",
        description: "Failed to block the time slot. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteBlockedSlotMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/blocked-slots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-slots"] });
      toast({
        title: "✅ Block Removed",
        description: "The time slot block has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "❌ Failed to Remove Block",
        description: "Failed to remove the time slot block. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Authorization check effect
  useEffect(() => {
    if (!user) {
      toast({
        title: "Access Denied",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    const adminEmails = ["groovegardenltd@gmail.com", "tomearl1508@gmail.com"];
    if (!adminEmails.includes(user.email)) {
      toast({
        title: "Unauthorized Access", 
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }
  }, [user, setLocation, toast]);

  const handleApprove = (userId: number) => {
    approveMutation.mutate(userId);
  };

  const handleReject = (userId: number) => {
    rejectMutation.mutate(userId);
  };

  const handleCreateBlockedSlot = () => {
    if (!blockSlotData.roomId || !blockSlotData.date || !blockSlotData.startTime || !blockSlotData.endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (blockSlotData.isRecurring && !blockSlotData.recurringUntil) {
      toast({
        title: "Missing Information",
        description: "Please select an end date for weekly recurring blocks.",
        variant: "destructive",
      });
      return;
    }
    
    if (blockSlotData.isRecurring && new Date(blockSlotData.recurringUntil) <= new Date(blockSlotData.date)) {
      toast({
        title: "Invalid Date",
        description: "Recurring end date must be after the start date.",
        variant: "destructive",
      });
      return;
    }
    
    createBlockedSlotMutation.mutate(blockSlotData);
  };

  const handleDeleteBlockedSlot = (id: number, isParentBlock: boolean = false) => {
    if (isParentBlock) {
      toast({
        title: "Delete Recurring Series?",
        description: "This will delete all recurring blocks in this series. This action cannot be undone.",
      });
    }
    deleteBlockedSlotMutation.mutate(id);
  };

  const getRoomName = (roomId: number): string => {
    if (!rooms || !Array.isArray(rooms)) return `Room ${roomId}`;
    const room = rooms.find((r: Room) => r.id === roomId);
    return room?.name || `Room ${roomId}`;
  };

  const getIdTypeLabel = (idType: string) => {
    switch (idType) {
      case "drivers_license": return "Driver's License";
      case "state_id": return "State ID";
      case "passport": return "Passport";
      case "military_id": return "Military ID";
      default: return idType;
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "Not provided";
    return phone;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 border-green-200">✓ Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏳ Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 border-red-200">✗ Rejected</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatBookingDate = (date: string) => {
    try {
      const [year, month, day] = date.split('-');
      const bookingDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return bookingDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return date;
    }
  };

  // Don't render content if not authorized (backup safety check)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Unauthorized access</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-music-purple" />
            <div>
              <h1 data-testid="admin-title" className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">Manage bookings, review ID verifications, and block time slots</p>
            </div>
          </div>
        </div>

        {/* Bookings Overview */}
        <div className="mb-8" data-testid="section-admin-bookings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  {bookingsViewMode === "calendar" ? "Bookings Calendar" : "Recent Bookings"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={bookingsViewMode === "calendar" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBookingsViewMode("calendar")}
                    data-testid="button-calendar-view"
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Calendar
                  </Button>
                  <Button
                    variant={bookingsViewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBookingsViewMode("list")}
                    data-testid="button-list-view"
                  >
                    <List className="h-4 w-4 mr-2" />
                    List
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Loading bookings...</span>
                </div>
              ) : !adminBookings || adminBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No bookings found</p>
                </div>
              ) : bookingsViewMode === "calendar" ? (
                <AdminCalendar bookings={adminBookings} blockedSlots={Array.isArray(blockedSlots) ? blockedSlots : []} />
              ) : (
                <div className="space-y-4" data-testid="admin-bookings-list">
                  {adminBookings.slice(0, 10).map((booking: AdminBooking) => (
                    <div key={booking.id} className="border rounded-lg p-4 bg-gray-50" data-testid={`admin-booking-${booking.id}`}>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left Column - User & Booking Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium" data-testid={`text-username-${booking.id}`}>{booking.userName}</span>
                            <span data-testid={`badge-verification-${booking.id}`}>{getVerificationBadge(booking.idVerificationStatus)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span data-testid={`text-email-${booking.id}`}>{booking.userEmail}</span>
                          </div>
                          {booking.userPhone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              <span data-testid={`text-phone-${booking.id}`}>{booking.userPhone}</span>
                            </div>
                          )}
                        </div>

                        {/* Middle Column - Booking Details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="font-medium" data-testid={`text-room-${booking.id}`}>{booking.roomName}</span>
                            <span data-testid={`badge-status-${booking.id}`}>{getStatusBadge(booking.status)}</span>
                          </div>
                          <div className="text-sm text-gray-600" data-testid={`text-datetime-${booking.id}`}>
                            <div>{formatBookingDate(booking.date)}</div>
                            <div>{booking.startTime} - {booking.endTime} ({booking.duration}h)</div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CreditCard className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-green-600" data-testid={`text-price-${booking.id}`}>£{booking.totalPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Right Column - Access & Details */}
                        <div className="space-y-2">
                          <div className="text-sm">
                            <div className="text-gray-600">Access Code:</div>
                            <div className="font-mono bg-white px-2 py-1 rounded border text-music-purple" data-testid={`text-access-code-${booking.id}`}>
                              {booking.accessCode}#
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            <div data-testid={`text-lock-access-${booking.id}`}>Lock Access: {booking.lockAccessEnabled ? "✅ Enabled" : "❌ Disabled"}</div>
                            <div data-testid={`text-created-${booking.id}`}>Booked: {formatDateTime(booking.createdAt)}</div>
                            <div data-testid={`text-booking-id-${booking.id}`}>ID: #{booking.id}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {adminBookings.length > 10 && (
                    <div className="text-center py-4 text-gray-500" data-testid="bookings-count-info">
                      <p>Showing 10 most recent bookings out of {adminBookings.length} total</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Blocked Slots Management */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarX className="h-5 w-5 text-red-500" />
                  Blocked Time Slots
                </CardTitle>
                <Dialog open={blockSlotDialogOpen} onOpenChange={setBlockSlotDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700" data-testid="add-blocked-slot">
                      <Plus className="h-4 w-4 mr-2" />
                      Block Time Slot
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Block Time Slot</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="room">Room</Label>
                        <Select value={blockSlotData.roomId} onValueChange={(value) => 
                          setBlockSlotData(prev => ({ ...prev, roomId: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a room" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(rooms) && rooms.map((room: Room) => (
                              <SelectItem key={room.id} value={room.id.toString()}>
                                {room.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={blockSlotData.date}
                          onChange={(e) => setBlockSlotData(prev => ({ ...prev, date: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startTime">Start Time</Label>
                          <Input
                            id="startTime"
                            type="time"
                            value={blockSlotData.startTime}
                            onChange={(e) => setBlockSlotData(prev => ({ ...prev, startTime: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endTime">End Time</Label>
                          <Input
                            id="endTime"
                            type="time"
                            value={blockSlotData.endTime}
                            onChange={(e) => setBlockSlotData(prev => ({ ...prev, endTime: e.target.value }))}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="reason">Reason (Optional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="e.g., Maintenance, Cleaning, Equipment repair..."
                          value={blockSlotData.reason}
                          onChange={(e) => setBlockSlotData(prev => ({ ...prev, reason: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="recurring"
                            checked={blockSlotData.isRecurring}
                            onCheckedChange={(checked) => setBlockSlotData(prev => ({ 
                              ...prev, 
                              isRecurring: !!checked,
                              recurringUntil: checked ? prev.recurringUntil : ""
                            }))}
                          />
                          <Label htmlFor="recurring" className="flex items-center gap-2">
                            <Repeat className="h-4 w-4" />
                            Repeat weekly
                          </Label>
                        </div>
                        
                        {blockSlotData.isRecurring && (
                          <div>
                            <Label htmlFor="recurringUntil">Repeat until</Label>
                            <Input
                              id="recurringUntil"
                              type="date"
                              value={blockSlotData.recurringUntil}
                              onChange={(e) => setBlockSlotData(prev => ({ ...prev, recurringUntil: e.target.value }))}
                              min={new Date(new Date(blockSlotData.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              This will create blocks every week from {blockSlotData.date} until the selected date
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleCreateBlockedSlot}
                          disabled={createBlockedSlotMutation.isPending}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          {createBlockedSlotMutation.isPending ? "Blocking..." : "Block Time Slot"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setBlockSlotDialogOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {blockedSlotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                  <span className="ml-3 text-gray-600">Loading blocked slots...</span>
                </div>
              ) : !blockedSlots || !Array.isArray(blockedSlots) || blockedSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarX className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No blocked time slots</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(blockedSlots) && blockedSlots
                    .sort((a, b) => {
                      // Sort by date first, then by isRecurring (parent blocks first)
                      const dateCompare = a.date.localeCompare(b.date);
                      if (dateCompare !== 0) return dateCompare;
                      if (a.isRecurring && !a.parentBlockId) return -1;
                      if (b.isRecurring && !b.parentBlockId) return 1;
                      return 0;
                    })
                    .map((slot: BlockedSlot) => {
                      const isParentBlock = slot.isRecurring && slot.parentBlockId === null;
                      const isChildBlock = slot.isRecurring && slot.parentBlockId !== null;
                      
                      return (
                        <div 
                          key={slot.id} 
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            isParentBlock 
                              ? 'border-purple-300 bg-purple-50' 
                              : isChildBlock 
                                ? 'border-red-200 bg-red-50 ml-6' 
                                : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-4 text-sm">
                              <Badge variant="secondary" className={
                                isParentBlock 
                                  ? "bg-purple-100 text-purple-800" 
                                  : "bg-red-100 text-red-800"
                              }>
                                {getRoomName(slot.roomId)}
                              </Badge>
                              <span className="font-medium">{slot.date}</span>
                              <span>{slot.startTime} - {slot.endTime}</span>
                              
                              {isParentBlock && (
                                <Badge variant="outline" className="bg-white text-purple-700 border-purple-300">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  Weekly until {slot.recurringUntil}
                                </Badge>
                              )}
                              
                              {isChildBlock && (
                                <Badge variant="outline" className="bg-white text-gray-600 border-gray-300">
                                  Recurring
                                </Badge>
                              )}
                            </div>
                            {slot.reason && (
                              <p className="text-xs text-gray-600 mt-1">{slot.reason}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBlockedSlot(slot.id, isParentBlock)}
                            disabled={deleteBlockedSlotMutation.isPending}
                            className={`hover:bg-red-100 ${
                              isParentBlock 
                                ? 'text-purple-600 hover:text-purple-700' 
                                : 'text-red-600 hover:text-red-700'
                            }`}
                            data-testid={`remove-block-${slot.id}`}
                            title={isParentBlock ? "Delete entire recurring series" : "Delete this block"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ID Verification Reviews */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-music-purple"></div>
            <span className="ml-3 text-gray-600">Loading pending verifications...</span>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600">Unable to fetch pending verifications. Please refresh the page.</p>
            </CardContent>
          </Card>
        ) : !pendingUsers || (Array.isArray(pendingUsers) && pendingUsers.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
              <p className="text-gray-600">No pending ID verifications to review.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span className="font-medium text-gray-900">
                    {Array.isArray(pendingUsers) ? pendingUsers.length : 0} Pending Review{Array.isArray(pendingUsers) && pendingUsers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Requires Action
                </Badge>
              </div>
            </div>

            {Array.isArray(pendingUsers) && pendingUsers.map((user: PendingUser) => (
              <Card key={user.id} data-testid={`user-card-${user.id}`} className="overflow-hidden border-l-4 border-l-orange-400">
                <CardHeader className="bg-orange-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="h-5 w-5 text-gray-600" />
                      {user.name || user.username}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      {user.idVerificationStatus}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* User Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        User Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Username:</span>
                          <span className="font-medium" data-testid={`username-${user.id}`}>{user.username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium" data-testid={`email-${user.id}`}>{user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium" data-testid={`phone-${user.id}`}>{formatPhone(user.phone)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID Type:</span>
                          <span className="font-medium" data-testid={`id-type-${user.id}`}>{getIdTypeLabel(user.idType)}</span>
                        </div>
                        {user.idNumber && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">ID Number:</span>
                            <span className="font-medium font-mono text-xs" data-testid={`id-number-${user.id}`}>
                              {user.idNumber.substring(0, 4)}...{user.idNumber.substring(user.idNumber.length - 4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ID Photos */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Uploaded Documents
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {user.idPhotoUrl && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">ID Photo</p>
                            <img 
                              src={user.idPhotoUrl}
                              alt="ID Document"
                              data-testid={`id-photo-${user.id}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(user.idPhotoUrl, '_blank')}
                            />
                          </div>
                        )}
                        {user.selfiePhotoUrl && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Selfie Photo</p>
                            <img 
                              src={user.selfiePhotoUrl}
                              alt="Selfie"
                              data-testid={`selfie-photo-${user.id}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(user.selfiePhotoUrl, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 italic">Click images to view full size</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`approve-button-${user.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Approving..." : "Approve User"}
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                      data-testid={`reject-button-${user.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {rejectMutation.isPending ? "Rejecting..." : "Reject User"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}