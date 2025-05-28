import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import logoImage from "@assets/groove-garden-logo.jpeg";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthState({ user: data.user, sessionId: data.sessionId });
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthState({ user: data.user, sessionId: data.sessionId });
      toast({
        title: "Account Created!",
        description: "Welcome to Harmony Studios!",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username: loginUsername, password: loginPassword });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (registerData.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    const { confirmPassword, ...dataToSubmit } = registerData;
    registerMutation.mutate(dataToSubmit);
  };

  const updateRegisterData = (field: string, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Music className="h-8 w-8 text-music-purple" />
            <h1 className="text-2xl font-bold text-music-purple">Groove Garden Studios</h1>
          </div>
          <h2 className="text-xl text-gray-900">
            Access Your Rehearsal Space
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to book rehearsal rooms and manage your sessions
          </p>
        </div>

        {/* Auth Forms */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-music-purple hover:bg-music-purple/90"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing In..." : "Sign In"}
                  </Button>
                </form>

                {/* Demo Credentials */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium mb-2">Demo Account:</p>
                  <p className="text-xs text-blue-700">
                    Create a new account to get started, or use the registration form above.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="register-name">Full Name</Label>
                      <Input
                        id="register-name"
                        type="text"
                        value={registerData.name}
                        onChange={(e) => updateRegisterData("name", e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-username">Username</Label>
                      <Input
                        id="register-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => updateRegisterData("username", e.target.value)}
                        placeholder="johndoe"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => updateRegisterData("email", e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-phone">Phone (Optional)</Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      value={registerData.phone}
                      onChange={(e) => updateRegisterData("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerData.password}
                      onChange={(e) => updateRegisterData("password", e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-confirm">Confirm Password</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={registerData.confirmPassword}
                      onChange={(e) => updateRegisterData("confirmPassword", e.target.value)}
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-music-purple hover:bg-music-purple/90"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
