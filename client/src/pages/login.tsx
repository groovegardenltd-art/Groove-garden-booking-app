import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import grooveGardenLogo from "@assets/groove-garden-logo.jpeg";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuthState } from "@/lib/auth";
import { useLocation, Link } from "wouter";

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
    idType: "",
    idNumber: "",
  });

  // ID photo state
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  
  // Selfie photo state
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

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
        description: "Welcome to Groove Garden Studios!",
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

  const handleRegister = async (e: React.FormEvent) => {
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

    // Validate ID verification fields
    if (!registerData.idType || !registerData.idNumber || !idPhoto || !selfiePhoto) {
      toast({
        title: "ID Verification Required",
        description: "Please complete ID verification (type, number, ID photo, and selfie required).",
        variant: "destructive",
      });
      return;
    }

    // Convert both photos to base64 for submission
    const idReader = new FileReader();
    const selfieReader = new FileReader();
    
    idReader.onload = () => {
      const idPhotoBase64 = idReader.result as string;
      
      selfieReader.onload = () => {
        const selfiePhotoBase64 = selfieReader.result as string;
        const { confirmPassword, ...dataToSubmit } = registerData;
        registerMutation.mutate({ ...dataToSubmit, idPhotoBase64, selfiePhotoBase64 });
      };
      selfieReader.readAsDataURL(selfiePhoto);
    };
    idReader.readAsDataURL(idPhoto);
  };

  const updateRegisterData = (field: string, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
  };

  // Handle ID photo upload
  const handleIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 15MB",
        variant: "destructive",
      });
      return;
    }

    setIdPhoto(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setIdPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeIdPhoto = () => {
    setIdPhoto(null);
    setIdPhotoPreview(null);
  };

  // Handle selfie photo upload
  const handleSelfiePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 15MB",
        variant: "destructive",
      });
      return;
    }

    setSelfiePhoto(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setSelfiePhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSelfiePhoto = () => {
    setSelfiePhoto(null);
    setSelfiePhotoPreview(null);
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex flex-col items-center mb-4">
            <img 
              src={grooveGardenLogo} 
              alt="Groove Garden Studio" 
              className="w-20 h-20 rounded-lg object-cover mb-4 shadow-lg"
            />
            <h1 className="text-xl sm:text-2xl font-bold text-green-600">Groove Garden Studios</h1>
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
                      data-testid="input-login-password"
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-green-600 hover:text-green-700 hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={loginMutation.isPending}
                    data-testid="button-login-submit"
                  >
                    {loginMutation.isPending ? "Signing In..." : "Sign In"}
                  </Button>
                </form>


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
                    <Label htmlFor="register-phone">Mobile Phone Number *</Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      value={registerData.phone}
                      onChange={(e) => {
                        // Auto-format the phone number as user types
                        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                        if (value.startsWith('44')) {
                          value = value.substring(2); // Remove country code if included
                        }
                        if (value.startsWith('7') && value.length <= 10) {
                          value = '0' + value; // Add leading 0 for UK mobile
                        }
                        if (value.length > 11) {
                          value = value.substring(0, 11); // Limit to 11 digits
                        }
                        // Add spacing for readability: 07123 456789
                        if (value.length > 5) {
                          value = value.substring(0, 5) + ' ' + value.substring(5);
                        }
                        updateRegisterData("phone", value);
                      }}
                      placeholder="07123 456789"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll use this for booking confirmations and access instructions
                    </p>
                  </div>

                  {/* ID Verification Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h4 className="text-sm font-semibold text-blue-800 mb-3">ID Verification (Required)</h4>
                    <p className="text-xs text-blue-600 mb-3">
                      For security purposes, we require one-time ID verification. Your ID will be reviewed within 24 hours.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="id-type">ID Type</Label>
                        <Select value={registerData.idType} onValueChange={(value) => updateRegisterData("idType", value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="drivers_license">Driver's License</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="state_id">State ID</SelectItem>
                            <SelectItem value="military_id">Military ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="id-number">ID Number</Label>
                        <Input
                          id="id-number"
                          type="text"
                          value={registerData.idNumber}
                          onChange={(e) => updateRegisterData("idNumber", e.target.value)}
                          placeholder="Enter your ID number"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="id-photo">ID Photo</Label>
                        <div className="space-y-2">
                          <Input
                            id="id-photo"
                            type="file"
                            accept="image/*"
                            onChange={handleIdPhotoChange}
                            className="cursor-pointer"
                            required
                          />
                          <p className="text-xs text-gray-500">
                            Upload a clear photo of your ID (max 15MB)
                          </p>
                          
                          {idPhotoPreview && (
                            <div className="relative">
                              <img 
                                src={idPhotoPreview} 
                                alt="ID Preview" 
                                className="w-32 h-20 object-cover rounded border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                onClick={removeIdPhoto}
                              >
                                ×
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="selfie-photo">Selfie Photo</Label>
                        <div className="space-y-2">
                          <Input
                            id="selfie-photo"
                            type="file"
                            accept="image/*"
                            onChange={handleSelfiePhotoChange}
                            className="cursor-pointer"
                            required
                          />
                          <p className="text-xs text-gray-500">
                            Upload a recent photo of yourself (max 15MB). On mobile, you can use the camera option.
                          </p>
                          
                          {selfiePhotoPreview && (
                            <div className="relative">
                              <img 
                                src={selfiePhotoPreview} 
                                alt="Selfie Preview" 
                                className="w-32 h-32 object-cover rounded-full border mx-auto"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                onClick={removeSelfiePhoto}
                              >
                                ×
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
