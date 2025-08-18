import { useState, useEffect } from "react";
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
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentForm } from "./payment-form";
import { TestPaymentForm } from "./test-payment-form";

// Test mode configuration
const TEST_MODE = import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_MODE === 'true';

// Initialize Stripe (only if not in test mode and key is available)
const stripePromise = (!TEST_MODE && import.meta.env.VITE_STRIPE_PUBLIC_KEY) 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoom: Room | null;
  selectedDate: string | null;
  selectedTime: string | null;
  selectedDuration: number;
  onBookingSuccess: (booking: any) => void;
}

export function BookingModal({
  open,
  onOpenChange,
  selectedRoom,
  selectedDate,
  selectedTime,
  selectedDuration,
  onBookingSuccess,
}: BookingModalProps) {
  const [contactPhone, setContactPhone] = useState("");

  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");

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
    setSpecialRequests("");
    setPaymentMethod("card");
    setAcceptedTerms(false);
    setIsSubmitting(false);
    setIdNumber("");
    setIdType("");
    setShowPayment(false);
    setClientSecret("");
    setPaymentIntentId("");
  };

  // Create payment intent
  const createPaymentIntent = async () => {
    const totalPrice = calculatePrice(selectedDuration);
    const response = await apiRequest("POST", "/api/create-payment-intent", {
      amount: totalPrice,
      currency: "gbp"
    });
    const data = await response.json();
    return data;
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

    if (!idNumber || !idType) {
      toast({
        title: "ID Verification Required",
        description: "Please provide your ID information for studio access.",
        variant: "destructive",
      });
      return;
    }

    // Create payment intent and show payment form
    try {
      setIsSubmitting(true);
      const paymentData = await createPaymentIntent();
      setClientSecret(paymentData.clientSecret);
      setPaymentIntentId(paymentData.paymentIntentId);
      setShowPayment(true);
    } catch (error) {
      toast({
        title: "Payment Setup Failed",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Create the booking after successful payment
    setIsSubmitting(true);

    if (!selectedRoom || !selectedDate || !selectedTime) return;

    const endTime = `${String(parseInt(selectedTime.split(':')[0]) + selectedDuration).padStart(2, '0')}:00`;
    
    const bookingData = {
      roomId: selectedRoom.id,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      duration: selectedDuration,
      totalPrice: calculatePrice(selectedDuration),
      contactPhone,

      specialRequests: specialRequests || null,
      idNumber,
      idType,
      paymentIntentId, // Include payment intent ID
    };

    bookingMutation.mutate(bookingData);
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

  const formatTime = (timeStr: string) => {
    const [hours, minutes = '00'] = timeStr.split(':');
    const hour = parseInt(hours);
    const minute = parseInt(minutes);
    const endHour = hour + selectedDuration;
    
    const formatHour = (h: number, m: number = 0) => {
      const minuteStr = m.toString().padStart(2, '0');
      if (h === 0) return `12:${minuteStr} AM`;
      if (h < 12) return `${h}:${minuteStr} AM`;
      if (h === 12) return `12:${minuteStr} PM`;
      return `${h - 12}:${minuteStr} PM`;
    };

    return `${formatHour(hour, minute)} - ${formatHour(endHour)}`;
  };

  const calculatePrice = (duration: number) => {
    switch (duration) {
      case 1:
        return 40;
      case 2:
        return 75;
      case 3:
        return 105;
      case 4:
        return 135;
      default:
        return duration * 40;
    }
  };

  const { user } = getAuthState();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {showPayment ? "Payment" : "Complete Your Booking"}
          </DialogTitle>
        </DialogHeader>

        {showPayment && clientSecret ? (
          TEST_MODE ? (
            <TestPaymentForm
              amount={calculatePrice(selectedDuration)}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPayment(false)}
            />
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                amount={calculatePrice(selectedDuration)}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
              />
            </Elements>
          ) : (
            <div className="text-center p-8">
              <p className="text-red-600">Payment service not configured</p>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Booking Details Review */}
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
                <span className="font-medium">{selectedDuration} {selectedDuration === 1 ? 'hour' : 'hours'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold text-music-purple text-lg">
                  £{calculatePrice(selectedDuration)}
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

            </div>
          </div>

          {/* ID Verification */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">ID Verification (Required for Self-Entry)</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="idType" className="text-sm font-medium text-gray-700">
                  ID Type *
                </Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="state_id">State ID</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="military_id">Military ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="idNumber" className="text-sm font-medium text-gray-700">
                  ID Number *
                </Label>
                <Input
                  id="idNumber"
                  type="text"
                  placeholder="Enter your ID number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  required
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for studio access verification and security
                </p>
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
              {isSubmitting ? "Processing..." : "Proceed to Payment"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
