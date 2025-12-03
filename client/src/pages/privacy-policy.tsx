import { Header } from "@/components/header";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: December 2025</p>
          
          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
              <p className="mb-3">
                Groove Garden Studios ("we", "our", "us") is committed to protecting your personal data and respecting your privacy. 
                This Privacy Policy explains how we collect, use, store, and protect your information when you use our music rehearsal 
                studio booking service.
              </p>
              <p>
                We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. 
                By using our services, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data Controller</h2>
              <p>
                Groove Garden Studios is the data controller responsible for your personal data. If you have any questions 
                about this privacy policy or our data practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mt-3">
                <p>Email: <a href="mailto:groovegardenltd@gmail.com" className="text-green-600 hover:underline">groovegardenltd@gmail.com</a></p>
                <p>Address: Groove Garden Studios, London, UK</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Personal Data We Collect</h2>
              <p className="mb-3">We collect and process the following categories of personal data:</p>
              
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Account Information</h3>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Full name</li>
                    <li>Email address</li>
                    <li>Username</li>
                    <li>Mobile phone number</li>
                    <li>Password (encrypted)</li>
                  </ul>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">Identity Verification</h3>
                  <ul className="list-disc list-inside space-y-1 text-purple-800">
                    <li>Government-issued ID type (e.g., driver's licence, passport)</li>
                    <li>ID document number</li>
                    <li>Photo of your ID document</li>
                    <li>Selfie photograph</li>
                  </ul>
                  <p className="mt-2 text-sm text-purple-700">
                    This data is collected for security verification to ensure safe access to our self-service studios.
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">Booking Information</h3>
                  <ul className="list-disc list-inside space-y-1 text-green-800">
                    <li>Booking dates and times</li>
                    <li>Room selections</li>
                    <li>Contact phone number for bookings</li>
                    <li>Special requests</li>
                    <li>Access codes (temporary, for booking duration only)</li>
                  </ul>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-orange-900 mb-2">Payment Information</h3>
                  <ul className="list-disc list-inside space-y-1 text-orange-800">
                    <li>Payment transaction references</li>
                    <li>Refund status and amounts</li>
                  </ul>
                  <p className="mt-2 text-sm text-orange-700">
                    <strong>Note:</strong> We do NOT store your card details. All payment processing is handled 
                    securely by Stripe. Please see Stripe's privacy policy at{" "}
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                      stripe.com/privacy
                    </a>
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Legal Basis for Processing</h2>
              <p className="mb-3">We process your personal data on the following legal grounds:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Contract Performance:</strong> Processing necessary to fulfil our booking service contract with you</li>
                <li><strong>Legitimate Interests:</strong> Security verification and fraud prevention for studio access</li>
                <li><strong>Consent:</strong> Where you have given explicit consent for specific purposes (e.g., marketing communications)</li>
                <li><strong>Legal Obligation:</strong> Where we are required to retain data for legal or regulatory purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How We Use Your Data</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To create and manage your account</li>
                <li>To process and confirm your bookings</li>
                <li>To verify your identity for secure studio access</li>
                <li>To generate temporary access codes for smart lock entry</li>
                <li>To process payments and refunds</li>
                <li>To send booking confirmations and reminders via email</li>
                <li>To respond to your enquiries and provide customer support</li>
                <li>To improve our services and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Service Providers</h2>
              <p className="mb-3">We share your data with the following trusted third parties who help us provide our services:</p>
              
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold">Stripe (Payment Processing)</h3>
                  <p className="text-sm text-gray-600">Handles all payment transactions securely. They receive payment card details directly.</p>
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">
                    View Stripe Privacy Policy
                  </a>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold">TTLock (Smart Lock Access)</h3>
                  <p className="text-sm text-gray-600">Manages electronic access codes for studio entry. Receives booking time data and access codes.</p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold">SendGrid (Email Service)</h3>
                  <p className="text-sm text-gray-600">Sends booking confirmations and notifications. Receives your email address and booking details.</p>
                  <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">
                    View SendGrid Privacy Policy
                  </a>
                </div>

                <div className="border-l-4 border-orange-500 pl-4">
                  <h3 className="font-semibold">Neon (Database Hosting)</h3>
                  <p className="text-sm text-gray-600">Securely stores your account and booking data in encrypted database storage.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
              <p className="mb-3">We retain your personal data for the following periods:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Account data:</strong> Until you request account deletion</li>
                <li><strong>Booking records:</strong> 30 days after the booking date (then automatically deleted)</li>
                <li><strong>ID verification data:</strong> Until you request account deletion or verification is no longer needed</li>
                <li><strong>Payment records:</strong> 7 years for accounting and legal compliance purposes</li>
                <li><strong>Access codes:</strong> Automatically deleted after booking ends</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights Under UK GDPR</h2>
              <p className="mb-3">You have the following rights regarding your personal data:</p>
              
              <div className="grid gap-3 md:grid-cols-2">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right of Access</h3>
                  <p className="text-sm">Request a copy of all personal data we hold about you</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right to Rectification</h3>
                  <p className="text-sm">Request correction of inaccurate or incomplete data</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right to Erasure</h3>
                  <p className="text-sm">Request deletion of your personal data ("right to be forgotten")</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right to Data Portability</h3>
                  <p className="text-sm">Receive your data in a structured, machine-readable format</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right to Object</h3>
                  <p className="text-sm">Object to processing based on legitimate interests</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-1">Right to Withdraw Consent</h3>
                  <p className="text-sm">Withdraw consent at any time where processing is based on consent</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="font-semibold text-green-900">How to Exercise Your Rights</p>
                <p className="text-green-800 text-sm mt-1">
                  You can exercise your rights through your account settings, or by contacting us at{" "}
                  <a href="mailto:groovegardenltd@gmail.com" className="underline">groovegardenltd@gmail.com</a>. 
                  We will respond to your request within 30 days.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Data Security</h2>
              <p className="mb-3">We implement appropriate security measures to protect your personal data:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>All passwords are encrypted using industry-standard hashing (bcrypt)</li>
                <li>HTTPS encryption for all data in transit</li>
                <li>Secure, encrypted database storage</li>
                <li>Regular security audits and updates</li>
                <li>Limited staff access to personal data on a need-to-know basis</li>
                <li>Automatic session expiration and logout</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cookies</h2>
              <p className="mb-3">Our website uses essential cookies for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Session cookies:</strong> To keep you logged in during your browsing session</li>
                <li><strong>Authentication cookies:</strong> To verify your identity for secure access</li>
              </ul>
              <p className="mt-3">
                We do not use advertising or tracking cookies. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. International Data Transfers</h2>
              <p>
                Your data may be processed by our third-party service providers in countries outside the UK. 
                Where this occurs, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses 
                approved by the UK Information Commissioner's Office (ICO).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Children's Privacy</h2>
              <p>
                Our services are not intended for individuals under 18 years of age. We do not knowingly collect 
                personal data from children. If you believe we have collected data from a child, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes by 
                email or through a notice on our website. Your continued use of our services after changes 
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Complaints</h2>
              <p className="mb-3">
                If you have concerns about how we handle your personal data, please contact us first. 
                If you are not satisfied with our response, you have the right to lodge a complaint with the 
                Information Commissioner's Office (ICO):
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">ico.org.uk</a></p>
                <p>Phone: 0303 123 1113</p>
              </div>
            </section>

            <section className="border-t pt-6">
              <div className="flex flex-wrap gap-4 text-sm">
                <Link href="/terms" className="text-green-600 hover:underline">Terms and Conditions</Link>
                <Link href="/cancellation-policy" className="text-green-600 hover:underline">Cancellation Policy</Link>
                <Link href="/" className="text-green-600 hover:underline">Back to Booking</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
