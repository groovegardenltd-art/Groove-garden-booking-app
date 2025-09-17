import { Header } from "@/components/header";

export default function CancellationPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Cancellation Policy</h1>
          
          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Cancellation Timeline</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                    <div>
                      <h3 className="font-semibold text-green-800">48+ Hours Before Booking</h3>
                      <p className="text-green-700">Full refund (100% of booking cost)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                    <div>
                      <h3 className="font-semibold text-red-800">Less than 48 Hours Before</h3>
                      <p className="text-red-700">No refund available</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Cancel Your Booking</h2>
              <div className="space-y-3">
                <p><strong>Online Cancellation (Recommended):</strong></p>
                <ol className="list-decimal ml-6 space-y-1">
                  <li>Log into your Groove Garden Studios account</li>
                  <li>Go to "My Bookings" section</li>
                  <li>Find your booking and click "Cancel Booking"</li>
                  <li>Confirm cancellation when prompted</li>
                  <li>You'll receive an email confirmation within minutes</li>
                </ol>
                
                <p className="pt-4"><strong>Phone Cancellation:</strong></p>
                <p>Call us at +44 (0) 20 1234 5678 during business hours (9 AM - 6 PM, Monday-Friday)</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Refund Processing</h2>
              <div className="space-y-2">
                <p>• Refunds are automatically processed to your original payment method</p>
                <p>• Processing time: 3-5 business days for credit/debit cards</p>
                <p>• PayPal refunds typically appear within 1-2 business days</p>
                <p>• You'll receive an email notification when the refund is initiated</p>
                <p>• Promo code discounts are factored into refund calculations</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Special Circumstances</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Emergency Situations</h3>
                  <p>In case of medical emergencies or family crises, please contact us directly. We may make exceptions to our standard policy on a case-by-case basis.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900">Technical Issues</h3>
                  <p>If you're unable to access the studio due to technical problems on our end, you'll receive a full refund or complimentary rebooking.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900">Weather/Natural Disasters</h3>
                  <p>For severe weather conditions or natural disasters that prevent safe travel, we offer flexible rebooking options or full refunds.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">No-Show Policy</h2>
              <div className="space-y-2">
                <p>• If you don't arrive within 30 minutes of your scheduled time without prior notice, your booking may be considered a no-show</p>
                <p>• No-show bookings are not eligible for refunds</p>
                <p>• Your access code will automatically expire at the scheduled end time</p>
                <p>• Contact us immediately if you're running late to avoid no-show charges</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Modifications vs. Cancellations</h2>
              <div className="space-y-2">
                <p><strong>Booking Changes:</strong></p>
                <p>• Date/time changes are subject to availability and must be made at least 4 hours before your original booking</p>
                <p>• Room upgrades may require additional payment</p>
                <p>• Duration extensions can be made if the studio is available</p>
                
                <p className="pt-3"><strong>When to Cancel vs. Modify:</strong></p>
                <p>• Cancel if you no longer need the studio</p>
                <p>• Modify if you need different dates, times, or room specifications</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact for Cancellation Support</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p><strong>Need help with your cancellation?</strong></p>
                <p>📧 Email: bookings@groovegardenstudios.com</p>
                <p>📞 Phone: +44 (0) 20 1234 5678</p>
                <p>🕒 Business Hours: Monday-Friday, 9 AM - 6 PM GMT</p>
                <p>💬 Response Time: We typically respond to emails within 2 hours during business hours</p>
              </div>
            </section>

            <section className="border-t pt-6">
              <p className="text-sm text-gray-600">
                This cancellation policy was last updated on August 26, 2025. 
                We reserve the right to modify this policy with advance notice to customers.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}