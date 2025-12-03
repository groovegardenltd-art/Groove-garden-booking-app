import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home = lazy(() => import("@/pages/home"));
const Bookings = lazy(() => import("@/pages/bookings"));
const LockManagement = lazy(() => import("@/pages/lock-management"));
const Login = lazy(() => import("@/pages/login"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Website = lazy(() => import("@/pages/website"));
const Terms = lazy(() => import("@/pages/terms"));
const CancellationPolicy = lazy(() => import("@/pages/cancellation-policy"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const AccountSettings = lazy(() => import("@/pages/account-settings"));
const IdVerificationAdmin = lazy(() => import("@/pages/id-verification-admin"));
const Admin = lazy(() => import("@/pages/admin"));
const ResubmitVerification = lazy(() => import("@/pages/resubmit-verification"));

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="text-center space-y-6 px-4">
        {/* Animated logo/icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse mx-auto mb-4"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">
            Groove Garden Studios
          </h2>
          <p className="text-gray-600 animate-pulse">
            Loading your booking experience...
          </p>
        </div>
        
        {/* Spinner */}
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-gray-600"></div>
        </div>
        
        {/* Progress hint */}
        <p className="text-sm text-gray-500 max-w-md">
          Just a moment while we prepare your studio booking system
        </p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/website" component={Website} />
        <Route path="/app" component={Home} />
        <Route path="/" component={Home} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/lock-management" component={LockManagement} />
        <Route path="/terms" component={Terms} />
        <Route path="/cancellation-policy" component={CancellationPolicy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/account-settings" component={AccountSettings} />
        <Route path="/admin/id-verification" component={IdVerificationAdmin} />
        <Route path="/admin" component={Admin} />
        <Route path="/resubmit-verification" component={ResubmitVerification} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
