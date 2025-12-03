import { useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearAuthState, getAuthState } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Download, Trash2, User, Shield, AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AccountSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const authState = getAuthState();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/me"],
    enabled: !!authState?.sessionId,
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/user/export-data");
      return response.json();
    },
    onSuccess: (data) => {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `groove-garden-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data Exported",
        description: "Your personal data has been downloaded as a JSON file.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export your data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/user/delete-account");
      return response.json();
    },
    onSuccess: () => {
      clearAuthState();
      queryClient.clear();
      toast({
        title: "Account Deleted",
        description: "Your account and all associated data has been permanently deleted.",
      });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete your account. Please contact support.",
        variant: "destructive",
      });
    },
  });

  if (!authState?.sessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Please Sign In</h2>
              <p className="text-gray-600 mb-4">You need to be logged in to access account settings.</p>
              <Link href="/login">
                <Button className="bg-green-600 hover:bg-green-700">Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and privacy settings</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{user?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Username</p>
                  <p className="font-medium">{user?.username || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{user?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{user?.phone || "-"}</p>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-sm text-gray-500">ID Verification Status</p>
                <p className={`font-medium ${
                  user?.idVerificationStatus === "verified" ? "text-green-600" :
                  user?.idVerificationStatus === "rejected" ? "text-red-600" :
                  "text-yellow-600"
                }`}>
                  {user?.idVerificationStatus === "verified" ? "✓ Verified" :
                   user?.idVerificationStatus === "rejected" ? "✗ Rejected" :
                   "⏳ Pending Review"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Your Data Rights (UK GDPR)
              </CardTitle>
              <CardDescription>
                Exercise your rights under the UK General Data Protection Regulation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Right to Data Portability</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Download a copy of all your personal data in a machine-readable format (JSON).
                </p>
                <Button
                  onClick={() => exportDataMutation.mutate()}
                  disabled={exportDataMutation.isPending}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  data-testid="button-export-data"
                >
                  {exportDataMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export My Data
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Other Rights</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Right of Access:</strong> Your data export includes all information we hold</li>
                  <li>• <strong>Right to Rectification:</strong> Contact us to correct any inaccurate data</li>
                  <li>• <strong>Right to Object:</strong> Contact us to object to specific data processing</li>
                  <li>• <strong>Right to Erasure:</strong> See "Delete Account" below</li>
                </ul>
                <p className="text-sm text-gray-600 mt-3">
                  For any data requests, email us at{" "}
                  <a href="mailto:groovegardenltd@gmail.com" className="text-green-600 hover:underline">
                    groovegardenltd@gmail.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-800 mb-3">
                  This action is <strong>permanent and irreversible</strong>. All your data will be deleted including:
                </p>
                <ul className="text-sm text-red-700 mb-4 list-disc list-inside">
                  <li>Your account and login credentials</li>
                  <li>All booking history</li>
                  <li>ID verification documents and photos</li>
                  <li>Personal information</li>
                </ul>
                <p className="text-sm text-red-800 mb-4">
                  <strong>Note:</strong> Any active or future bookings will be cancelled. 
                  Refunds for bookings made more than 48 hours in advance will be processed automatically.
                </p>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-account">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete My Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>
                          This action cannot be undone. This will permanently delete your account
                          and remove all your data from our servers.
                        </p>
                        <p>
                          Type <strong>DELETE</strong> below to confirm:
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                          placeholder="Type DELETE to confirm"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                          data-testid="input-delete-confirm"
                        />
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAccountMutation.mutate()}
                        disabled={deleteConfirmText !== "DELETE" || deleteAccountMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="button-confirm-delete"
                      >
                        {deleteAccountMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Yes, Delete My Account"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-gray-500 space-y-2">
            <p>
              Learn more about how we handle your data in our{" "}
              <Link href="/privacy-policy" className="text-green-600 hover:underline">
                Privacy Policy
              </Link>
            </p>
            <p>
              <Link href="/" className="text-green-600 hover:underline">
                ← Back to Booking
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
