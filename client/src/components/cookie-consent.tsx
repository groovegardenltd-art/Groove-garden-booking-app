import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { X, Cookie } from "lucide-react";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "accepted");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setIsVisible(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookie-consent", "declined");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg animate-in slide-in-from-bottom-5 duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Cookie Notice</p>
              <p className="text-sm text-gray-600">
                We use essential cookies to keep you logged in and provide our booking service. 
                We do not use advertising or tracking cookies.{" "}
                <Link href="/privacy-policy" className="text-green-600 hover:underline">
                  Learn more in our Privacy Policy
                </Link>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={declineCookies}
              className="flex-1 sm:flex-initial"
              data-testid="button-decline-cookies"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={acceptCookies}
              className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700"
              data-testid="button-accept-cookies"
            >
              Accept Cookies
            </Button>
          </div>
          
          <button
            onClick={declineCookies}
            className="absolute top-2 right-2 sm:static p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close cookie banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
