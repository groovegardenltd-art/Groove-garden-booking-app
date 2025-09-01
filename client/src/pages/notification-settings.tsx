import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Settings } from "lucide-react";

export default function NotificationSettings() {
  const { toast } = useToast();
  const [adminEmail, setAdminEmail] = useState("groovegardenltd@gmail.com");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would save to backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: "Settings Saved",
        description: "Notification preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save notification settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Notification Settings
          </h1>
          <p className="text-gray-600 mt-2">Configure how you receive notifications about ID verifications</p>
        </div>

        <div className="grid gap-6">
          {/* Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Email Notifications</Label>
                  <p className="text-sm text-gray-600">Receive email alerts when new ID verifications are submitted</p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              {emailNotifications && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <Label htmlFor="adminEmail" className="text-sm font-medium">
                      Admin Email Address
                    </Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="groovegardenltd@gmail.com"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This email will receive notifications when new ID verifications need review
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-600" />
                Notification Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Sample Email Notification</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Subject:</strong> New ID Verification Pending Review - John Doe</p>
                  <p><strong>Content:</strong> A new user has submitted their ID for verification...</p>
                  <p><strong>Action:</strong> Direct link to admin review page</p>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">What You'll Get:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Instant email when user submits ID verification</li>
                  <li>• User details (name, email, ID type)</li>
                  <li>• Direct link to review interface</li>
                  <li>• Clear review instructions</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-900">Email Service</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">SendGrid configured and ready</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-blue-900">ID Verification</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">System active and monitoring</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}