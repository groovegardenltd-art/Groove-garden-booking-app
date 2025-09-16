import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, FileText, Shield } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

interface PendingUser {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  idType: string;
  idNumber: string;
  idPhotoUrl: string;
  selfiePhotoUrl: string;
  idVerificationStatus: string;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isAuthorizing, setIsAuthorizing] = useState(true);

  // Check if user is admin
  useEffect(() => {
    const { user } = getAuthState();
    if (!user) {
      toast({
        title: "Access Denied",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    if (user.email !== "groovegardenltd@gmail.com") {
      toast({
        title: "Unauthorized Access",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }
    setIsAuthorizing(false);
  }, [setLocation, toast]);

  // Show loading while checking authorization
  if (isAuthorizing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-music-purple"></div>
          <span className="ml-3 text-gray-600">Checking authorization...</span>
        </div>
      </div>
    );
  }

  const { data: pendingUsers, isLoading, error } = useQuery({
    queryKey: ["/api/admin/id-verifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "✅ User Approved",
        description: "User has been verified and can now make bookings.",
      });
    },
    onError: () => {
      toast({
        title: "❌ Approval Failed",
        description: "Failed to approve ID verification. Please try again.",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/reject`, { reason: "ID verification requirements not met" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "❌ User Rejected", 
        description: "User's verification was rejected and future bookings cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "❌ Rejection Failed",
        description: "Failed to reject ID verification. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleApprove = (userId: number) => {
    approveMutation.mutate(userId);
  };

  const handleReject = (userId: number) => {
    rejectMutation.mutate(userId);
  };

  const getIdTypeLabel = (idType: string) => {
    switch (idType) {
      case "drivers_license": return "Driver's License";
      case "state_id": return "State ID";
      case "passport": return "Passport";
      case "military_id": return "Military ID";
      default: return idType;
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "Not provided";
    return phone;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-music-purple" />
            <div>
              <h1 data-testid="admin-title" className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">Review and manage ID verifications</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-music-purple"></div>
            <span className="ml-3 text-gray-600">Loading pending verifications...</span>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600">Unable to fetch pending verifications. Please refresh the page.</p>
            </CardContent>
          </Card>
        ) : !pendingUsers || (Array.isArray(pendingUsers) && pendingUsers.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
              <p className="text-gray-600">No pending ID verifications to review.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span className="font-medium text-gray-900">
                    {Array.isArray(pendingUsers) ? pendingUsers.length : 0} Pending Review{Array.isArray(pendingUsers) && pendingUsers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Requires Action
                </Badge>
              </div>
            </div>

            {Array.isArray(pendingUsers) && pendingUsers.map((user: PendingUser) => (
              <Card key={user.id} data-testid={`user-card-${user.id}`} className="overflow-hidden border-l-4 border-l-orange-400">
                <CardHeader className="bg-orange-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="h-5 w-5 text-gray-600" />
                      {user.name || user.username}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      {user.idVerificationStatus}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* User Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        User Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Username:</span>
                          <span className="font-medium" data-testid={`username-${user.id}`}>{user.username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium" data-testid={`email-${user.id}`}>{user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium" data-testid={`phone-${user.id}`}>{formatPhone(user.phone)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID Type:</span>
                          <span className="font-medium" data-testid={`id-type-${user.id}`}>{getIdTypeLabel(user.idType)}</span>
                        </div>
                        {user.idNumber && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">ID Number:</span>
                            <span className="font-medium font-mono text-xs" data-testid={`id-number-${user.id}`}>
                              {user.idNumber.substring(0, 4)}...{user.idNumber.substring(user.idNumber.length - 4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ID Photos */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Uploaded Documents
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {user.idPhotoUrl && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">ID Photo</p>
                            <img 
                              src={user.idPhotoUrl}
                              alt="ID Document"
                              data-testid={`id-photo-${user.id}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(user.idPhotoUrl, '_blank')}
                            />
                          </div>
                        )}
                        {user.selfiePhotoUrl && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Selfie Photo</p>
                            <img 
                              src={user.selfiePhotoUrl}
                              alt="Selfie"
                              data-testid={`selfie-photo-${user.id}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(user.selfiePhotoUrl, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 italic">Click images to view full size</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`approve-button-${user.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Approving..." : "Approve User"}
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                      data-testid={`reject-button-${user.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {rejectMutation.isPending ? "Rejecting..." : "Reject User"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}