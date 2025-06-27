import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Lock, Wifi, Battery, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";

export default function SmartLock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch smart lock status
  const { data: lockStatus, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ["/api/smart-lock/status"],
    retry: false,
  });

  // Fetch access logs
  const { data: accessLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/smart-lock/logs"],
    enabled: !!lockStatus?.configured,
    retry: false,
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/smart-lock/test-connection", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Test Successful",
        description: `Smart lock is ${data.lock_online ? 'online' : 'offline'}, battery at ${data.battery_level}%`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-lock/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to TTLock service",
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    await testConnectionMutation.mutateAsync();
    setIsTestingConnection(false);
  };

  const renderConfigurationInstructions = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          TTLock Setup Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            TTLock API credentials are required to enable smart lock integration. Follow these steps to set up your smart lock.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold">1. Get TTLock API Credentials</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
            <li>Create a TTLock developer account at <code>https://developer.ttlock.com</code></li>
            <li>Register your application to get Client ID and Client Secret</li>
            <li>Note your TTLock account username and password</li>
            <li>Find your lock ID from the TTLock mobile app</li>
          </ul>

          <h4 className="font-semibold">2. Configure Environment Variables</h4>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">Required environment variables:</p>
            <div className="space-y-1 text-sm font-mono">
              <div>TTLOCK_CLIENT_ID=your_client_id</div>
              <div>TTLOCK_CLIENT_SECRET=your_client_secret</div>
              <div>TTLOCK_USERNAME=your_ttlock_username</div>
              <div>TTLOCK_PASSWORD=your_ttlock_password</div>
              <div>TTLOCK_LOCK_ID=your_lock_id</div>
            </div>
          </div>

          <h4 className="font-semibold">3. Test Connection</h4>
          <p className="text-sm text-gray-600">
            Once configured, use the "Test Connection" button below to verify your setup.
          </p>
        </div>

        <Button 
          onClick={handleTestConnection}
          disabled={isTestingConnection || testConnectionMutation.isPending}
          className="w-full"
        >
          {isTestingConnection || testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
        </Button>
      </CardContent>
    </Card>
  );

  const renderLockStatus = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Smart Lock Status
          </div>
          <Badge variant={lockStatus?.isOnline ? "default" : "destructive"}>
            {lockStatus?.isOnline ? "Online" : "Offline"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              Connection: {lockStatus?.isOnline ? "Connected" : "Disconnected"}
            </span>
          </div>
          {lockStatus?.batteryLevel && (
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Battery: {lockStatus.batteryLevel}%</span>
            </div>
          )}
        </div>

        <Separator />

        <Button 
          onClick={handleTestConnection}
          disabled={isTestingConnection || testConnectionMutation.isPending}
          variant="outline"
          className="w-full"
        >
          {isTestingConnection || testConnectionMutation.isPending ? "Testing..." : "Refresh Status"}
        </Button>
      </CardContent>
    </Card>
  );

  const renderAccessLogs = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Access Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logsLoading ? (
          <div className="text-center py-4">Loading access logs...</div>
        ) : accessLogs && accessLogs.length > 0 ? (
          <div className="space-y-2">
            {accessLogs.slice(0, 10).map((log: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {log.success ? "Access Granted" : "Access Denied"}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No access logs available
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Lock Management</h1>
          <p className="text-gray-600">
            Configure and monitor your TTLock smart lock integration for automated studio access.
          </p>
        </div>

        <div className="space-y-6">
          {statusError || !lockStatus?.configured ? (
            renderConfigurationInstructions()
          ) : (
            <>
              {renderLockStatus()}
              {renderAccessLogs()}
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>How Smart Lock Integration Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <h4 className="font-medium">Automatic Passcode Generation</h4>
                  <p className="text-sm text-gray-600">When a booking is confirmed, a unique 6-digit passcode is automatically generated for your TTLock.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <h4 className="font-medium">Time-Limited Access</h4>
                  <p className="text-sm text-gray-600">Passcodes are valid only during the booked time slot, automatically expiring after the session ends.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <h4 className="font-medium">Secure Access Control</h4>
                  <p className="text-sm text-gray-600">Users receive their passcode with booking confirmation. Access is automatically revoked if bookings are cancelled.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}