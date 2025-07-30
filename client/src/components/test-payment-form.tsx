import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TestPaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TestPaymentForm({ amount, onSuccess, onCancel }: TestPaymentFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTestPayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Test Payment Successful",
      description: "This is a test booking - no real payment was charged.",
    });
    
    onSuccess();
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <TestTube className="w-5 h-5" />
            <span className="font-medium">Test Mode Active</span>
          </div>
          <p className="text-sm text-amber-600 mt-1">
            This is a test booking - no real payment will be charged.
          </p>
        </CardContent>
      </Card>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Payment</h3>
        <p className="text-gray-600">
          Test Total: <span className="font-semibold text-music-purple">£{amount}</span>
        </p>
      </div>

      <div className="flex gap-3">
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
          type="button"
          onClick={handleTestPayment}
          disabled={isProcessing}
          className="flex-1 bg-music-purple hover:bg-music-purple/90"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Test Payment...
            </>
          ) : (
            `Complete Test Booking (£${amount})`
          )}
        </Button>
      </div>
    </div>
  );
}