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
const IdVerificationAdmin = lazy(() => import("@/pages/id-verification-admin"));
const Admin = lazy(() => import("@/pages/admin"));
const ResubmitVerification = lazy(() => import("@/pages/resubmit-verification"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
