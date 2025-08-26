import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Bookings from "@/pages/bookings";
import LockManagement from "@/pages/lock-management";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Website from "@/pages/website";

function Router() {
  return (
    <Switch>
      <Route path="/website" component={Website} />
      <Route path="/app" component={Home} />
      <Route path="/" component={Home} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/lock-management" component={LockManagement} />
      <Route path="/login" component={Login} />
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
