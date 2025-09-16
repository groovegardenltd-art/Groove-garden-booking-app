import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Bookings from "@/pages/bookings";
import LockManagement from "@/pages/lock-management";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import Website from "@/pages/website";
import Terms from "@/pages/terms";
import CancellationPolicy from "@/pages/cancellation-policy";
import IdVerificationAdmin from "@/pages/id-verification-admin";
import Admin from "@/pages/admin";

function Router() {
  return (
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
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
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
