import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Upload, X, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthState } from "@/lib/auth";

export default function ResubmitVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState<string | null>(null);

  // Check if user is authenticated and actually rejected
  const { user } = getAuthState();
  
  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.idVerificationStatus !== "rejected") {
    setLocation("/");
    return null;
  }

  // Handle ID photo upload (reused from login.tsx)
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

  // Handle selfie photo upload (reused from login.tsx)
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

  // Resubmission mutation
  const resubmissionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/id-verification/resubmit", data),
    onSuccess: () => {
      toast({
        title: "Verification Resubmitted",
        description: "Your ID verification has been resubmitted for review. You'll receive an email when it's processed.",
        variant: "default",
      });
      // Refresh user data and redirect to home
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Resubmission Failed",
        description: error.message || "Failed to resubmit verification. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    if (!idType || !idNumber || !idPhoto || !selfiePhoto) {
      toast({
        title: "Missing Information",
        description: "Please complete all required fields including both photos.",
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
        resubmissionMutation.mutate({ 
          idType, 
          idNumber, 
          idPhotoBase64, 
          selfiePhotoBase64 
        });
      };
      selfieReader.readAsDataURL(selfiePhoto);
    };
    idReader.readAsDataURL(idPhoto);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Resubmit ID Verification
            </CardTitle>
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <AlertDescription>
                Your previous ID verification was declined. Please resubmit your documents with the improvements noted in your rejection email.
              </AlertDescription>
            </Alert>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleResubmit} className="space-y-6">
              {/* ID Type Selection */}
              <div>
                <Label htmlFor="idType">ID Type *</Label>
                <Select value={idType} onValueChange={setIdType} required>
                  <SelectTrigger data-testid="select-id-type">
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

              {/* ID Number */}
              <div>
                <Label htmlFor="idNumber">ID Number *</Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Enter your ID number"
                  required
                  data-testid="input-id-number"
                />
              </div>

              {/* ID Photo Upload */}
              <div>
                <Label>ID Photo * (front side, clear, well-lit)</Label>
                <div className="mt-2">
                  {!idPhotoPreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <Label
                          htmlFor="idPhoto"
                          className="cursor-pointer rounded-md bg-music-purple text-white font-medium px-4 py-2 hover:bg-music-purple/90"
                        >
                          Upload ID Photo
                        </Label>
                        <Input
                          id="idPhoto"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleIdPhotoChange}
                          data-testid="input-id-photo"
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">PNG, JPG up to 15MB</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={idPhotoPreview}
                        alt="ID Preview"
                        className="w-full max-w-md mx-auto rounded-lg shadow-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeIdPhoto}
                        data-testid="button-remove-id-photo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Selfie Photo Upload */}
              <div>
                <Label>Selfie Photo * (clear face, holding your ID next to your face)</Label>
                <div className="mt-2">
                  {!selfiePhotoPreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <Label
                          htmlFor="selfiePhoto"
                          className="cursor-pointer rounded-md bg-music-purple text-white font-medium px-4 py-2 hover:bg-music-purple/90"
                        >
                          Upload Selfie
                        </Label>
                        <Input
                          id="selfiePhoto"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleSelfiePhotoChange}
                          data-testid="input-selfie-photo"
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">PNG, JPG up to 15MB</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={selfiePhotoPreview}
                        alt="Selfie Preview"
                        className="w-full max-w-md mx-auto rounded-lg shadow-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeSelfiePhoto}
                        data-testid="button-remove-selfie-photo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Resubmission Guidelines */}
              <Alert className="border-blue-200 bg-blue-50 text-blue-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>For best results:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Ensure good lighting and clear, readable text</li>
                    <li>• Hold your ID next to your face in the selfie</li>
                    <li>• Make sure your name matches your account details</li>
                    <li>• Use current, valid identification</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="flex-1"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resubmissionMutation.isPending || !idType || !idNumber || !idPhoto || !selfiePhoto}
                  className="flex-1 bg-music-purple hover:bg-music-purple/90"
                  data-testid="button-resubmit"
                >
                  {resubmissionMutation.isPending ? "Submitting..." : "Resubmit for Review"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}