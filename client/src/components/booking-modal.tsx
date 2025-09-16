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
import { CreditCard, Coins, Upload, X, CheckCircle, Clock, XCircle } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentForm } from "./payment-form";
import { TestPaymentForm } from "./test-payment-form";

// Test mode configuration
const TEST_MODE = import.meta.env.VITE_ENABLE_TEST_MODE === 'true';

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
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<any>(null);
  const [promoCodeError, setPromoCodeError] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current user from auth state
  const { user: authUser } = getAuthState();
  
  // Fetch complete user data including ID verification fields
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/me'],
    enabled: !!authUser,
  });
  
  // Use authUser as fallback if complete user data isn't loaded yet
  const currentUser = user || authUser;
  
  // Removed phone number logic - email confirmations only

  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      if (!authUser) throw new Error("Not authenticated");

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
    setPromoCode("");
    setAppliedPromoCode(null);
    setPromoCodeError("");
    setIsValidatingPromo(false);
    setPaymentMethod("card");
    setAcceptedTerms(false);
    setIsSubmitting(false);
    setShowPayment(false);
    setClientSecret("");
    setPaymentIntentId("");
  };

  // Validate promo code
  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError("Please enter a promo code");
      return;
    }

    if (!selectedRoom) {
      setPromoCodeError("Please select a room first");
      return;
    }

    setIsValidatingPromo(true);
    setPromoCodeError("");

    try {
      const originalPrice = calculatePrice(selectedDuration);
      const response = await apiRequest("POST", "/api/validate-promo-code", {
        code: promoCode.trim(),
        bookingAmount: originalPrice,
        roomId: selectedRoom.id
      });
      
      const data = await response.json();
      setAppliedPromoCode(data);
      toast({
        title: "Promo Code Applied!",
        description: `You saved £${data.discountAmount}!`,
      });
    } catch (error: any) {
      setPromoCodeError(error.message || "Invalid promo code");
      setAppliedPromoCode(null);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    setPromoCode("");
    setAppliedPromoCode(null);
    setPromoCodeError("");
  };

  // Handle ID photo upload

  // Create payment intent
  const createPaymentIntent = async () => {
    const finalAmount = appliedPromoCode ? Number(appliedPromoCode.finalAmount) : calculatePrice(selectedDuration);
    const response = await apiRequest("POST", "/api/create-payment-intent", {
      amount: finalAmount,
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


    // In test mode, directly process the booking without payment steps
    if (TEST_MODE) {
      await handleDirectBooking();
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

  const handleDirectBooking = async () => {
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
      // contactPhone removed - email confirmations only
      idNumber: currentUser?.idNumber || "",
      idType: currentUser?.idType || "",
      paymentIntentId: "test_mode_booking", // Test mode identifier
    };

    bookingMutation.mutate(bookingData);
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
      // contactPhone removed - email confirmations only
      idNumber: currentUser?.idNumber || "",
      idType: currentUser?.idType || "",
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
    if (!selectedRoom || !selectedTime) return 0;

    // Check if room has time-based pricing
    const room = selectedRoom as any;
    if (room.dayPricePerHour && room.eveningPricePerHour) {
      return calculateTimeBasedPrice(room, selectedTime, duration);
    }
    
    // For rooms without time-based pricing, use standard hourly rate
    let totalPrice = duration * parseFloat(room.pricePerHour || "40");
    
    // Apply 10% discount for bookings over 4 hours
    if (duration > 4) {
      totalPrice = totalPrice * 0.9; // 10% discount
    }
    
    return totalPrice;
  };

  const calculateTimeBasedPrice = (room: any, startTime: string, duration: number) => {
    const dayPrice = parseFloat(room.dayPricePerHour || "8");
    const eveningPrice = parseFloat(room.eveningPricePerHour || "10");
    const dayStart = room.dayHoursStart || "09:00";
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
    
    // Apply 10% discount for bookings over 4 hours
    if (duration > 4) {
      totalPrice = totalPrice * 0.9; // 10% discount
    }
    
    return totalPrice;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-full mx-2 max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {showPayment ? "Payment" : "Complete Your Booking"}
          </DialogTitle>
        </DialogHeader>

        {showPayment && clientSecret ? (
          TEST_MODE ? (
            <TestPaymentForm
              amount={appliedPromoCode ? Number(appliedPromoCode.finalAmount) : calculatePrice(selectedDuration)}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPayment(false)}
            />
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                amount={appliedPromoCode ? Number(appliedPromoCode.finalAmount) : calculatePrice(selectedDuration)}
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
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Booking Details Review */}
          {/* Booking Details Review */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Booking Details</h4>
            <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 truncate">Room:</span>
                <span className="font-medium text-right">{selectedRoom?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-right">
                  {selectedDate ? formatDate(selectedDate) : "Not selected"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-right">
                  {selectedTime ? formatTime(selectedTime) : "Not selected"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-right">{selectedDuration} {selectedDuration === 1 ? 'hr' : 'hrs'}</span>
              </div>
              {appliedPromoCode && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-right">£{calculatePrice(selectedDuration).toFixed(2)}</span>
                </div>
              )}
              {appliedPromoCode && (
                <div className="flex justify-between items-center">
                  <span className="text-green-600 text-xs sm:text-sm truncate">
                    Discount ({appliedPromoCode.promoCode.code}):
                  </span>
                  <span className="font-medium text-green-600 text-right">
                    -£{appliedPromoCode.discountAmount}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-600 font-medium">Total:</span>
                <span className="font-semibold text-music-purple text-base sm:text-lg">
                  £{appliedPromoCode ? appliedPromoCode.finalAmount : calculatePrice(selectedDuration).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Promo Code Section */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Promo Code</h4>
            {!appliedPromoCode ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className={promoCodeError ? "border-red-300" : ""}
                  />
                  {promoCodeError && (
                    <p className="text-red-600 text-sm mt-1">{promoCodeError}</p>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={validatePromoCode}
                  disabled={isValidatingPromo || !promoCode.trim()}
                  className="bg-music-purple hover:bg-music-purple/90"
                >
                  {isValidatingPromo ? "Checking..." : "Apply"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-green-800">
                      {appliedPromoCode.promoCode.code} applied
                    </p>
                    {appliedPromoCode.promoCode.description && (
                      <p className="text-sm text-green-600">
                        {appliedPromoCode.promoCode.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePromoCode}
                  className="text-green-700 hover:text-green-800"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Contact Information</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="contact" className="text-sm font-medium text-gray-700">
                  Primary Contact
                </Label>
                <Input
                  id="contact"
                  type="text"
                  value={currentUser?.name || ""}
                  disabled
                  className="mt-1"
                />
              </div>
              {/* Show saved phone number from registration */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-800 font-medium">Mobile Number on File</span>
              </div>
              <p className="text-xs sm:text-sm text-green-700 mt-1">
                Email confirmations to: <strong>{currentUser?.email}</strong>
              </p>
            </div>

            </div>
          </div>


          {/* Payment Method */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Payment Method</h4>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 border border-gray-300 rounded-lg">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center cursor-pointer text-sm sm:text-base">
                  <CreditCard className="w-4 h-4 text-gray-500 mr-2" />
                  Credit/Debit Card
                </Label>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 border border-gray-300 rounded-lg">
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal" className="flex items-center cursor-pointer text-sm sm:text-base">
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
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              I agree to the{" "}
              <a href="/terms" target="_blank" className="text-music-indigo hover:underline">
                terms and conditions
              </a>{" "}
              and{" "}
              <a href="/cancellation-policy" target="_blank" className="text-music-indigo hover:underline">
                cancellation policy
              </a>
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 text-sm sm:text-base"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-music-purple hover:bg-music-purple/90 text-sm sm:text-base"
              disabled={isSubmitting || !acceptedTerms}
            >
              {isSubmitting ? "Processing..." : TEST_MODE ? "Confirm Booking" : "Proceed to Payment"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
