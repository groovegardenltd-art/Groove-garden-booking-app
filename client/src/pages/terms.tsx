import { Header } from "@/components/header";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms and Conditions</h1>
          
          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Booking and Payment</h2>
              <div className="space-y-2">
                <p>• All bookings must be paid in full at the time of reservation.</p>
                <p>• Payment is processed securely through Stripe payment processing.</p>
                <p>• Promo codes, when applicable, will be applied before payment processing.</p>
                <p>• Prices are quoted in British Pounds (£) and include applicable taxes.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Studio Access</h2>
              <div className="space-y-2">
                <p>• Access codes are provided automatically upon booking confirmation.</p>
                <p>• You must provide valid ID information for studio access verification.</p>
                <p>• Access codes are time-limited to your booking duration only.</p>
                <p>• Do not share access codes with unauthorized individuals.</p>
                <p>• Studio hours: Monday-Saturday, 9:00 AM - 12:00 AM (Midnight).</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Studio Usage Rules</h2>
              <div className="space-y-2">
                <p>• Maximum booking duration: 12 hours per session.</p>
                <p>• Minimum booking for Live Room evening sessions (5 PM onwards): 3 hours. Pods have no minimum.</p>
                <p>• You are responsible for any damage to equipment or facilities.</p>
                <p>• No smoking, food, or drinks (except water) in the studios.</p>
                <p>• Clean up after your session and return equipment to proper locations.</p>
                <p>• Volume levels must be respectful of neighboring studios and businesses.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Cancellation Policy</h2>
              <div className="space-y-2">
                <p>• <strong>24+ Hours Notice:</strong> Full refund available.</p>
                <p>• <strong>2-24 Hours Notice:</strong> 50% refund provided.</p>
                <p>• <strong>Less than 2 Hours:</strong> No refund available.</p>
                <p>• Cancellations can be made through your account dashboard.</p>
                <p>• Refunds are processed within 3-5 business days to original payment method.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Liability and Insurance</h2>
              <div className="space-y-2">
                <p>• Groove Garden Studios is not liable for personal injury or property damage.</p>
                <p>• Users are responsible for their own equipment and personal belongings.</p>
                <p>• You agree to use facilities at your own risk.</p>
                <p>• Proper insurance coverage is recommended for valuable equipment.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Privacy</h2>
              <div className="space-y-2">
                <p>• Personal information is stored securely and used only for booking purposes.</p>
                <p>• Payment information is processed through Stripe and not stored on our servers.</p>
                <p>• ID verification data is used solely for studio access security.</p>
                <p>• We do not share personal information with third parties.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Prohibited Activities</h2>
              <div className="space-y-2">
                <p>• No illegal activities or substances on premises.</p>
                <p>• No recording or broadcasting without explicit permission.</p>
                <p>• No subletting or transferring bookings to unauthorized parties.</p>
                <p>• No modifications to studio equipment or facilities.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Information</h2>
              <div className="space-y-2">
                <p>For questions or concerns regarding these terms:</p>
                <p>• Email: info@groovegardenstudios.com</p>
                <p>• Phone: +44 (0) 20 1234 5678</p>
                <p>• Address: Groove Garden Studios, London, UK</p>
              </div>
            </section>

            <section className="border-t pt-6">
              <p className="text-sm text-gray-600">
                Last updated: August 26, 2025. These terms are subject to change. 
                Continued use of our services constitutes acceptance of any updated terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}