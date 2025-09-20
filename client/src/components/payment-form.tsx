import { useState } from "react";
import React from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentForm({ amount, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: "Your booking has been confirmed!",
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Debug Apple Pay availability
  const debugApplePay = () => {
    console.log('🍎 Apple Pay Debug Info:');
    console.log('- User Agent:', navigator.userAgent);
    console.log('- Current domain:', window.location.hostname);
    console.log('- HTTPS:', window.location.protocol === 'https:');
    
    // Type-safe Apple Pay detection
    const hasApplePaySession = 'ApplePaySession' in window;
    console.log('- ApplePaySession available:', hasApplePaySession);
    
    if (hasApplePaySession) {
      try {
        const ApplePaySession = (window as any).ApplePaySession;
        console.log('- Apple Pay supported:', ApplePaySession.supportsVersion(3));
        console.log('- Can make payments:', ApplePaySession.canMakePayments());
      } catch (error) {
        console.log('- Apple Pay check failed:', error);
      }
    }
  };

  // Run debug on mount
  React.useEffect(() => {
    debugApplePay();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Details</h3>
        <p className="text-gray-600">
          Total: <span className="font-semibold text-music-purple">£{amount}</span>
        </p>
        
        {/* Debug info for development */}
        <div className="text-xs text-gray-400 mt-2">
          Domain: {window.location.hostname}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement 
          options={{
            layout: "tabs",
            paymentMethodOrder: ["apple_pay", "google_pay", "card"],
          }}
        />
        
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 bg-music-purple hover:bg-music-purple/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay £${amount}`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}