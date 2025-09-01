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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import React from "react";
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
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<any>(null);
  const [promoCodeError, setPromoCodeError] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current user and prefill phone number
  const { user } = getAuthState();
  
  // Initialize phone number from user profile
  React.useEffect(() => {
    if (user?.phone && !contactPhone) {
      setContactPhone(user.phone);
    }
  }, [user?.phone, contactPhone]);

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
    const { user } = getAuthState();
    setContactPhone(user?.phone || "");
    setPromoCode("");
    setAppliedPromoCode(null);
    setPromoCodeError("");
    setIsValidatingPromo(false);
    setPaymentMethod("card");
    setAcceptedTerms(false);
    setIsSubmitting(false);
    setIdNumber("");
    setIdType("");
    setIdPhoto(null);
    setIdPhotoPreview(null);
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

    setIsValidatingPromo(true);
    setPromoCodeError("");

    try {
      const originalPrice = calculatePrice(selectedDuration);
      const response = await apiRequest("POST", "/api/validate-promo-code", {
        code: promoCode.trim(),
        bookingAmount: originalPrice
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
  const handleIdPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image file (JPG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setIdPhoto(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setIdPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIdPhoto = () => {
    setIdPhoto(null);
    setIdPhotoPreview(null);
  };

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

    if (!idNumber || !idType) {
      toast({
        title: "ID Verification Required",
        description: "Please provide your ID information for studio access.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if user needs ID verification
    if (user?.idVerificationStatus !== "verified") {
      if (!idPhoto) {
        toast({
          title: "ID Photo Required",
          description: "Please upload a clear photo of your ID for verification.",
          variant: "destructive",
        });
        return;
      }
      
      // Upload ID verification first
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const idPhotoBase64 = reader.result as string;
          
          await apiRequest("/api/id-verification/upload", "POST", { idType, idNumber, idPhotoBase64 });
          
          toast({
            title: "ID Verification Submitted",
            description: "Your ID will be reviewed within 24 hours. You can continue with your booking.",
          });
        };
        reader.readAsDataURL(idPhoto);
      } catch (error) {
        toast({
          title: "ID Upload Failed", 
          description: "Failed to upload ID photo. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!contactPhone) {
      toast({
        title: "Mobile Phone Required",
        description: "Please provide a mobile phone number for booking confirmation and access instructions.",
        variant: "destructive",
      });
      return;
    }

    // Basic UK mobile phone validation
    const phoneRegex = /^(\+44|0)(7\d{9})$/;
    if (!phoneRegex.test(contactPhone.replace(/\s/g, ''))) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid UK mobile number (e.g., 07123 456789).",
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
    
    // Save phone number to user profile if it's new or different
    if (user && contactPhone && (!user.phone || user.phone !== contactPhone)) {
      try {
        await apiRequest("/api/user/phone", "PATCH", { phone: contactPhone });
      } catch (error) {
        console.warn('Failed to update user phone number:', error);
      }
    }

    const bookingData = {
      roomId: selectedRoom.id,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      duration: selectedDuration,
      totalPrice: calculatePrice(selectedDuration),
      contactPhone,
      idNumber,
      idType,
      paymentIntentId: "test_mode_booking", // Test mode identifier
    };

    bookingMutation.mutate(bookingData);
  };

  const handlePaymentSuccess = async () => {
    // Create the booking after successful payment
    setIsSubmitting(true);

    if (!selectedRoom || !selectedDate || !selectedTime) return;

    const endTime = `${String(parseInt(selectedTime.split(':')[0]) + selectedDuration).padStart(2, '0')}:00`;
    
    // Save phone number to user profile if it's new or different
    if (user && contactPhone && (!user.phone || user.phone !== contactPhone)) {
      try {
        await apiRequest("/api/user/phone", "PATCH", { phone: contactPhone });
      } catch (error) {
        console.warn('Failed to update user phone number:', error);
      }
    }

    const bookingData = {
      roomId: selectedRoom.id,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      duration: selectedDuration,
      totalPrice: calculatePrice(selectedDuration),
      contactPhone,
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
      <DialogContent className="sm:max-w-md max-h-screen overflow-y-auto">
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
              {appliedPromoCode && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">£{calculatePrice(selectedDuration).toFixed(2)}</span>
                </div>
              )}
              {appliedPromoCode && (
                <div className="flex justify-between">
                  <span className="text-green-600">
                    Discount ({appliedPromoCode.promoCode.code}):
                  </span>
                  <span className="font-medium text-green-600">
                    -£{appliedPromoCode.discountAmount}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold text-music-purple text-lg">
                  £{appliedPromoCode ? appliedPromoCode.finalAmount : calculatePrice(selectedDuration).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Promo Code Section */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Promo Code</h4>
            {!appliedPromoCode ? (
              <div className="flex gap-2">
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
                  Mobile Phone Number *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="07123 456789"
                  value={contactPhone}
                  onChange={(e) => {
                    // Auto-format the phone number as user types
                    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                    if (value.startsWith('44')) {
                      value = value.substring(2); // Remove country code if included
                    }
                    if (value.startsWith('7') && value.length <= 10) {
                      value = '0' + value; // Add leading 0 for UK mobile
                    }
                    if (value.length > 11) {
                      value = value.substring(0, 11); // Limit to 11 digits
                    }
                    // Add spacing for readability: 07123 456789
                    if (value.length > 5) {
                      value = value.substring(0, 5) + ' ' + value.substring(5);
                    }
                    setContactPhone(value);
                  }}
                  required
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll use this to contact you about your booking and send access instructions via SMS
                </p>
              </div>

            </div>
          </div>

          {/* ID Verification */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">ID Verification (Required for Self-Entry)</h4>
            
            {user?.idVerificationStatus === "verified" ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">ID Verified ✓</span>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  Your ID has been verified. You can access the studio using the provided access code.
                </p>
              </div>
            ) : user?.idVerificationStatus === "pending" ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-800 font-medium">ID Under Review</span>
                </div>
                <p className="text-yellow-700 text-sm mt-1">
                  Your ID is being reviewed. You can still make bookings and we'll confirm access within 24 hours.
                </p>
              </div>
            ) : user?.idVerificationStatus === "rejected" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">ID Verification Required</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  Please resubmit your ID verification with a clear photo of your government-issued ID.
                </p>
              </div>
            ) : null}
            
            {(user?.idVerificationStatus !== "verified") && (
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
              
              {/* ID Photo Upload */}
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Upload ID Photo *
                </Label>
                <div className="mt-2">
                  {!idPhotoPreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIdPhotoChange}
                        className="hidden"
                        id="id-photo-upload"
                      />
                      <label 
                        htmlFor="id-photo-upload" 
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Click to upload your ID photo
                        </span>
                        <span className="text-xs text-gray-500">
                          PNG, JPG up to 5MB
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={idPhotoPreview} 
                        alt="ID Preview" 
                        className="w-full max-w-sm h-40 object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={removeIdPhoto}
                        className="absolute top-2 right-2 p-1 bg-red-100 rounded-full hover:bg-red-200 transition-colors"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Upload a clear photo of your government-issued ID for verification. 
                    This helps ensure studio security and protects all users.
                  </p>
                </div>
              </div>
            </div>
            )}
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
              {isSubmitting ? "Processing..." : TEST_MODE ? "Confirm Booking" : "Proceed to Payment"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
