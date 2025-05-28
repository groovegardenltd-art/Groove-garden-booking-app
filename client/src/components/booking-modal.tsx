import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Room } from "@shared/schema";
import { CreditCard, Coins } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoom: Room | null;
  selectedDate: string | null;
  selectedTime: string | null;
  onBookingSuccess: (booking: any) => void;
}

export function BookingModal({
  open,
  onOpenChange,
  selectedRoom,
  selectedDate,
  selectedTime,
  onBookingSuccess,
}: BookingModalProps) {
  const [contactPhone, setContactPhone] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { user } = getAuthState();
      if (!user) throw new Error("Not authenticated");

      const response = await apiRequest("POST", "/api/bookings", bookingData);
      return response.json();
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      onBookingSuccess(booking);
      resetForm();
      onOpenChange(false);
      toast({
        title: "Booking Confirmed!",
        description: "Your rehearsal room has been successfully booked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setContactPhone("");
    setNumberOfPeople("1");
    setSpecialRequests("");
    setPaymentMethod("card");
    setAcceptedTerms(false);
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRoom || !selectedDate || !selectedTime) {
      toast({
        title: "Invalid Selection",
        description: "Please select a room, date, and time.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const endTime = `${String(parseInt(selectedTime.split(':')[0]) + 1).padStart(2, '0')}:00`;
    
    const bookingData = {
      roomId: selectedRoom.id,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      duration: 1,
      totalPrice: selectedRoom.pricePerHour,
      contactPhone,
      numberOfPeople: parseInt(numberOfPeople),
      specialRequests: specialRequests || null,
    };

    bookingMutation.mutate(bookingData);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours] = timeStr.split(':');
    const hour = parseInt(hours);
    const nextHour = hour + 1;
    
    const formatHour = (h: number) => {
      if (h === 0) return "12:00 AM";
      if (h < 12) return `${h}:00 AM`;
      if (h === 12) return "12:00 PM";
      return `${h - 12}:00 PM`;
    };

    return `${formatHour(hour)} - ${formatHour(nextHour)}`;
  };

  const { user } = getAuthState();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Complete Your Booking
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Booking Details Review */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Booking Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Room:</span>
                <span className="font-medium">{selectedRoom?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">
                  {selectedDate ? formatDate(selectedDate) : "Not selected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium">
                  {selectedTime ? formatTime(selectedTime) : "Not selected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">1 hour</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold text-music-purple text-lg">
                  ${selectedRoom?.pricePerHour}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="contact" className="text-sm font-medium text-gray-700">
                  Primary Contact
                </Label>
                <Input
                  id="contact"
                  type="text"
                  value={user?.name || ""}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="people" className="text-sm font-medium text-gray-700">
                  Number of People
                </Label>
                <Select value={numberOfPeople} onValueChange={setNumberOfPeople}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 person</SelectItem>
                    <SelectItem value="2">2 people</SelectItem>
                    <SelectItem value="3">3 people</SelectItem>
                    <SelectItem value="4">4 people</SelectItem>
                    <SelectItem value="5">5+ people</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <Label htmlFor="requests" className="text-sm font-medium text-gray-700">
              Special Requests
            </Label>
            <Textarea
              id="requests"
              placeholder="Any special equipment needs or requests..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Payment Method */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Payment Method</h4>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center cursor-pointer">
                  <CreditCard className="w-4 h-4 text-gray-500 mr-2" />
                  Credit/Debit Card
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg">
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal" className="flex items-center cursor-pointer">
                  <Coins className="w-4 h-4 text-gray-500 mr-2" />
                  PayPal
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Terms */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
            />
            <Label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
              I agree to the{" "}
              <a href="#" className="text-music-indigo hover:underline">
                terms and conditions
              </a>{" "}
              and{" "}
              <a href="#" className="text-music-indigo hover:underline">
                cancellation policy
              </a>
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-music-purple hover:bg-music-purple/90"
              disabled={isSubmitting || !acceptedTerms}
            >
              {isSubmitting ? "Processing..." : "Confirm Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
