import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, CreditCard, FileText, Image } from "lucide-react";
import { useState, useEffect } from "react";

// Lazy loading photo component
function LazyPhoto({ userId, type, label }: { userId: number; type: 'id' | 'selfie'; label: string }) {
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const loadPhoto = async () => {
    if (photoUrl || loading) return; // Already loaded or loading
    
    setLoading(true);
    setError(false);
    
    try {
      const response = await apiRequest('GET', `/api/admin/id-verifications/${userId}/photo?type=${type}`) as any;
      const json = await response.json();
      setPhotoUrl(json.photoUrl);
    } catch (err) {
      console.error('Failed to load photo:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <p className="text-sm text-gray-600 mb-3 font-medium">{label} for Review</p>
        
        {!photoUrl && !loading && !error && (
          <div 
            className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-center"
            onClick={loadPhoto}
            style={{ minHeight: '120px' }}
            data-testid="photo-load-button"
          >
            <div className="text-center">
              <Image className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-blue-700">📸 Click to load photo</p>
              <p className="text-xs text-blue-500 mt-1">{label}</p>
            </div>
          </div>
        )}
        
        {loading && (
          <div 
            className="bg-gray-100 rounded p-4 flex items-center justify-center"
            style={{ minHeight: '120px' }}
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading photo...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div 
            className="bg-red-50 rounded p-4 flex items-center justify-center cursor-pointer hover:bg-red-100"
            onClick={loadPhoto}
            style={{ minHeight: '120px' }}
          >
            <div className="text-center">
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-500">Failed to load photo</p>
              <p className="text-xs text-red-400">Click to retry</p>
            </div>
          </div>
        )}
        
        {photoUrl && (
          <div className="bg-gray-100 rounded p-2">
            <img 
              src={photoUrl} 
              alt={label} 
              className="w-full h-48 object-contain rounded"
              style={{ maxHeight: '200px', minHeight: '100px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface PendingUser {
  id: number;
  name: string;
  email: string;
  username: string;
  idType: string;
  idNumber: string;
  hasIdPhoto: boolean;
  hasSelfiePhoto: boolean;
  idVerificationStatus: string;
}

export default function IdVerificationAdmin() {
  console.log("🚀 PRODUCTION DEBUG - ID Verification Admin page loaded!");
  console.log("🚀 PRODUCTION DEBUG - Current URL:", window.location.href);
  console.log("🚀 PRODUCTION DEBUG - User agent:", navigator.userAgent);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  const { data: pendingUsers, isLoading, error } = useQuery({
    queryKey: ["/api/admin/id-verifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Debug logging when data changes
  useEffect(() => {
    console.log("🟢 PRODUCTION DEBUG - Query state changed:");
    console.log("  isLoading:", isLoading);
    console.log("  error:", error);
    console.log("  data:", pendingUsers);
    if (Array.isArray(pendingUsers)) {
      console.log("  Array length:", pendingUsers.length);
      if (pendingUsers.length > 0) {
        console.log("  First user:", pendingUsers[0]);
      }
    }
  }, [pendingUsers, isLoading, error]);

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "ID Verification Approved",
        description: "User has been verified and can now make bookings.",
      });
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve ID verification. Please try again.",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/admin/id-verifications/${userId}/reject`, { reason: "ID verification failed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/id-verifications"] });
      toast({
        title: "ID Verification Rejected", 
        description: "User will need to resubmit their ID verification.",
      });
    },
    onError: () => {
      toast({
        title: "Rejection Failed",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">ID Verification Admin</h1>
            <p className="text-gray-600 mt-2">Review and approve pending ID verifications</p>
          </div>
          
          <Card>
            <CardContent className="py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">
                {(error as any)?.message === "Authentication required" 
                  ? "You need to be logged in as an admin to access this page."
                  : "Failed to load ID verifications. Please try refreshing the page."
                }
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ID Verification Admin</h1>
          <p className="text-gray-600 mt-2">Review and approve pending ID verifications</p>
        </div>

        <div className="bg-red-100 border border-red-400 rounded p-4 mb-4">
          <h3 className="font-bold text-red-800">🐛 FRONTEND DEBUG INFO</h3>
          <p><strong>pendingUsers type:</strong> {typeof pendingUsers}</p>
          <p><strong>pendingUsers:</strong> {pendingUsers ? JSON.stringify(pendingUsers).substring(0, 200) + '...' : 'null'}</p>
          <p><strong>isLoading:</strong> {isLoading ? 'true' : 'false'}</p>
          <p><strong>error:</strong> {error ? String(error) : 'null'}</p>
          <p><strong>Array.isArray(pendingUsers):</strong> {Array.isArray(pendingUsers) ? 'true' : 'false'}</p>
          <p><strong>pendingUsers.length:</strong> {Array.isArray(pendingUsers) ? pendingUsers.length : 'N/A'}</p>
          <p><strong>First user hasIdPhoto:</strong> {Array.isArray(pendingUsers) && pendingUsers[0] ? pendingUsers[0].hasIdPhoto : 'N/A'}</p>
        </div>

        {!pendingUsers || (Array.isArray(pendingUsers) && pendingUsers.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
              <p className="text-gray-600">No pending ID verifications to review.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {Array.isArray(pendingUsers) && pendingUsers.map((user: PendingUser) => (
              <Card key={user.id} className="overflow-hidden">
                <CardHeader className="bg-yellow-50 border-b border-yellow-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      Pending Review
                    </CardTitle>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      {user.idVerificationStatus}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  {/* User Information */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{getIdTypeLabel(user.idType)}</p>
                        <p className="text-sm text-gray-600">{user.idNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Photos Grid */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* ID Photo */}
                    {user.hasIdPhoto && (
                      <LazyPhoto userId={user.id} type="id" label="ID Photo" />
                    )}
                    {!user.hasIdPhoto && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">ID Photo</span>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <p className="text-sm text-gray-500">No photo uploaded</p>
                        </div>
                      </div>
                    )}

                    {/* Selfie Photo */}
                    {user.hasSelfiePhoto && (
                      <LazyPhoto userId={user.id} type="selfie" label="Selfie Photo" />
                    )}
                    {!user.hasSelfiePhoto && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Selfie Photo</span>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <p className="text-sm text-gray-500">No selfie uploaded</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review Instructions */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Review Checklist:</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• ID photo is clear and legible</li>
                      <li>• ID type matches selection</li>
                      <li>• ID number matches entry</li>
                      <li>• Name matches user account</li>
                      <li>• ID appears valid and current</li>
                      <li>• Selfie photo shows the person clearly</li>
                      <li>• Person in selfie matches the person in ID photo</li>
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <Button 
                      onClick={() => handleApprove(user.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Verification
                    </Button>
                    
                    <Button 
                      onClick={() => handleReject(user.id)}
                      disabled={rejectMutation.isPending}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Verification
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