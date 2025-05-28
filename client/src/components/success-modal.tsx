import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, RectangleEllipsis, Smartphone, DoorOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onViewDetails?: () => void;
}

export function SuccessModal({
  open,
  onOpenChange,
  booking,
  onViewDetails,
}: SuccessModalProps) {
  const { toast } = useToast();

  const copyAccessCode = () => {
    if (booking?.accessCode) {
      navigator.clipboard.writeText(booking.accessCode);
      toast({
        title: "Access Code Copied!",
        description: "The access code has been copied to your clipboard.",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours] = timeStr.split(':');
    const hour = parseInt(hours);
    
    if (hour === 0) return "12:00 AM";
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return "12:00 PM";
    return `${hour - 12}:00 PM`;
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Booking Confirmed!
          </h3>
          <p className="text-gray-600 mb-6">
            Your rehearsal room has been successfully booked.
          </p>

          {/* Booking Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-medium text-gray-900 mb-3">Booking Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Booking ID:</span>
                <span className="font-medium">#{booking.id.toString().padStart(6, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Room:</span>
                <span className="font-medium">{booking.room?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date & Time:</span>
                <span className="font-medium">
                  {formatDate(booking.date)}, {formatTime(booking.startTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Access Code */}
          <div className="bg-music-indigo/5 border border-music-indigo/20 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Your Access Code</h4>
            <div className="flex items-center justify-center space-x-2 mb-2">
              <code className="bg-music-indigo text-white px-4 py-2 rounded-lg text-2xl font-mono tracking-wider">
                {booking.accessCode}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAccessCode}
                className="p-2 text-music-indigo hover:bg-music-indigo hover:text-white"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Use this code to unlock {booking.room?.name || 'the room'} on your booking date
            </p>
          </div>

          {/* Next Steps */}
          <div className="text-left mb-6">
            <h4 className="font-medium text-gray-900 mb-2">What's Next?</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center">
                <RectangleEllipsis className="h-4 w-4 text-music-indigo mr-2" />
                Confirmation email sent to your inbox
              </li>
              <li className="flex items-center">
                <Smartphone className="h-4 w-4 text-music-indigo mr-2" />
                Access code will be activated 15 minutes before your session
              </li>
              <li className="flex items-center">
                <DoorOpen className="h-4 w-4 text-music-indigo mr-2" />
                Enter the code on the smart lock keypad
              </li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1 bg-music-purple hover:bg-music-purple/90"
              onClick={() => {
                onViewDetails?.();
                onOpenChange(false);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
