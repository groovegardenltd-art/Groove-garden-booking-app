import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, CreditCard, FileText } from "lucide-react";

interface PendingUser {
  id: number;
  name: string;
  email: string;
  username: string;
  idType: string;
  idNumber: string;
  idPhotoUrl: string;
  selfiePhotoUrl: string;
  idVerificationStatus: string;
}

export default function IdVerificationAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["/api/admin/id-verifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/admin/id-verifications/${userId}/approve`, "POST"),
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
    mutationFn: (userId: number) => apiRequest(`/api/admin/id-verifications/${userId}/reject`, "POST", { reason: "ID verification failed" }),
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ID Verification Admin</h1>
          <p className="text-gray-600 mt-2">Review and approve pending ID verifications</p>
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
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">ID Photo</span>
                      </div>
                      
                      {user.idPhotoUrl ? (
                        <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-2">ID Photo for Review</p>
                          <img 
                            src={user.idPhotoUrl} 
                            alt="ID Photo" 
                            className="w-full h-32 object-contain rounded border"
                          />
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <p className="text-sm text-gray-500">No photo uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Selfie Photo */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Selfie Photo</span>
                      </div>
                      
                      {user.selfiePhotoUrl ? (
                        <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-2">Selfie Photo for Review</p>
                          <img 
                            src={user.selfiePhotoUrl} 
                            alt="Selfie Photo" 
                            className="w-full h-32 object-contain rounded border"
                          />
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <p className="text-sm text-gray-500">No selfie uploaded</p>
                        </div>
                      )}
                    </div>
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