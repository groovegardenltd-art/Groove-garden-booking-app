import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Lock, CheckCircle, XCircle, RefreshCw, AlertCircle, DoorOpen } from "lucide-react";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Room } from "@shared/schema";

export default function LockManagement() {
  const { toast } = useToast();
  const [newLockData, setNewLockData] = useState({
    roomId: "",
    lockId: "",
    lockName: "",
  });
  const [syncLockId, setSyncLockId] = useState("");
  const [syncResults, setSyncResults] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: { bookingId: number; error: string }[];
  } | null>(null);

  // Fetch rooms
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["/api/rooms"],
  });

  // Fetch bookings that need passcode sync
  const { data: passcodeBookings, refetch: refetchPasscodes } = useQuery<{
    count: number;
    bookings: Array<{
      id: number;
      date: string;
      startTime: string;
      endTime: string;
      roomId: number;
      ttlockPasscode: string;
    }>;
  }>({
    queryKey: ["/api/admin/bookings-with-passcodes"],
  });

  // Test lock connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/smart-lock/test-connection");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Test Successful",
        description: `Lock "${data.tested_lock}" is ${data.lock_online ? 'online' : 'offline'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to TTLock service",
        variant: "destructive",
      });
    },
  });

  // Sync passcodes to new lock
  const syncPasscodesMutation = useMutation({
    mutationFn: async (targetLockId: string) => {
      const response = await apiRequest("POST", "/api/admin/sync-passcodes", {
        targetLockId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSyncResults(data);
      toast({
        title: "Passcode Sync Complete",
        description: `${data.success} of ${data.total} passcodes synced successfully.`,
      });
      refetchPasscodes();
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync passcodes",
        variant: "destructive",
      });
    },
  });

  // Update all locks at once (for replacing hardware)
  const updateAllLocksMutation = useMutation({
    mutationFn: async (data: { newLockId: string; newLockName: string }) => {
      const response = await apiRequest("PATCH", "/api/admin/update-all-locks", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "All Locks Updated",
        description: `${data.updatedRooms} rooms now use the new lock ID.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update lock configuration",
        variant: "destructive",
      });
    },
  });

  // Update room lock configuration
  const updateLockMutation = useMutation({
    mutationFn: async (data: { roomId: number; lockId: string; lockName: string }) => {
      const response = await apiRequest("PATCH", `/api/rooms/${data.roomId}/lock`, {
        lockId: data.lockId,
        lockName: data.lockName,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lock Configuration Updated",
        description: "Room lock settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setNewLockData({ roomId: "", lockId: "", lockName: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update lock configuration",
        variant: "destructive",
      });
    },
  });

  // Remove lock from room
  const removeLockMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const response = await apiRequest("DELETE", `/api/rooms/${roomId}/lock`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lock Removed",
        description: "Lock has been removed from the room successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove lock configuration",
        variant: "destructive",
      });
    },
  });

  const handleAddLock = () => {
    if (!newLockData.roomId || !newLockData.lockId || !newLockData.lockName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    updateLockMutation.mutate({
      roomId: parseInt(newLockData.roomId),
      lockId: newLockData.lockId,
      lockName: newLockData.lockName,
    });
  };

  const handleRemoveLock = (roomId: number) => {
    removeLockMutation.mutate(roomId);
  };

  if (roomsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Smart Lock Management</h2>
          <p className="text-gray-600">
            Configure TTLock smart locks for each rehearsal room to enable automatic access control.
          </p>
        </div>

        {/* Current Front Door Lock */}
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center text-green-800">
              <DoorOpen className="mr-2 h-5 w-5" />
              Front Door Lock (Automated Passcodes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    This is the lock that receives automated passcodes for all bookings.
                    Customers use this code to enter the building.
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-lg py-2 px-4 bg-green-100 text-green-800">
                      <Lock className="w-4 h-4 mr-2 inline" />
                      Lock ID: {rooms[0]?.lockId || "Not configured"}
                    </Badge>
                    {rooms[0]?.lockName && (
                      <span className="text-sm text-gray-500">
                        ({rooms[0].lockName})
                      </span>
                    )}
                  </div>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                All {rooms.length} rooms share this front door lock. Individual room locks are changed manually.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Connection Test */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="mr-2 h-5 w-5" />
              Connection Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Test the TTLock API connection and verify your credentials are working.
              </p>
              <Button
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
                data-testid="button-test-connection"
              >
                {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Passcode Sync for New Lock */}
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <RefreshCw className="mr-2 h-5 w-5" />
              Sync Passcodes to New Lock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-4 rounded-lg mb-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-800">Replacing your lock?</h4>
                  <p className="text-sm text-gray-600">
                    When you install a new lock, you need to transfer all existing booking passcodes to it.
                    This will re-upload all future booking passcodes to your new lock.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <Badge variant="outline" className="text-lg py-2 px-4">
                  {passcodeBookings?.count ?? 0} future bookings with passcodes
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="syncLockId">New Lock ID</Label>
                <Input
                  id="syncLockId"
                  value={syncLockId}
                  onChange={(e) => setSyncLockId(e.target.value)}
                  placeholder="Enter your new lock's ID from TTLock app"
                  data-testid="input-sync-lock-id"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in TTLock app → Lock Settings → Device Information → Lock ID
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (!syncLockId) {
                      toast({
                        title: "Lock ID Required",
                        description: "Please enter the new lock ID first",
                        variant: "destructive",
                      });
                      return;
                    }
                    syncPasscodesMutation.mutate(syncLockId);
                  }}
                  disabled={syncPasscodesMutation.isPending || !syncLockId}
                  className="flex-1"
                  data-testid="button-sync-passcodes"
                >
                  {syncPasscodesMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing Passcodes...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync {passcodeBookings?.count ?? 0} Passcodes to New Lock
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!syncLockId) {
                      toast({
                        title: "Lock ID Required",
                        description: "Please enter the new lock ID first",
                        variant: "destructive",
                      });
                      return;
                    }
                    updateAllLocksMutation.mutate({
                      newLockId: syncLockId,
                      newLockName: "Front Door",
                    });
                  }}
                  disabled={updateAllLocksMutation.isPending || !syncLockId}
                  data-testid="button-update-all-locks"
                >
                  {updateAllLocksMutation.isPending ? "Updating..." : "Update All Rooms"}
                </Button>
              </div>
            </div>

            {/* Sync Results */}
            {syncResults && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <h4 className="font-semibold mb-2">Sync Results</h4>
                <div className="flex gap-4 mb-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    ✓ {syncResults.success} successful
                  </Badge>
                  {syncResults.failed > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      ✗ {syncResults.failed} failed
                    </Badge>
                  )}
                </div>
                {syncResults.errors.length > 0 && (
                  <div className="text-sm text-red-600 mt-2">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc list-inside">
                      {syncResults.errors.map((err, idx) => (
                        <li key={idx}>Booking #{err.bookingId}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Lock Configurations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Lock Configurations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rooms.map((room: Room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <h4 className="font-semibold">{room.name}</h4>
                      <p className="text-sm text-gray-600">{room.description}</p>
                    </div>
                    {room.lockId ? (
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                          Lock Configured
                        </Badge>
                        <div className="text-xs text-gray-500">
                          <div>Lock ID: {room.lockId}</div>
                          <div>Name: {room.lockName}</div>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="flex items-center">
                        <XCircle className="w-3 h-3 mr-1 text-gray-400" />
                        No Lock
                      </Badge>
                    )}
                  </div>
                  {room.lockId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveLock(room.id)}
                      disabled={removeLockMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add New Lock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Add Lock to Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="room">Room</Label>
                <Select value={newLockData.roomId} onValueChange={(value) => 
                  setNewLockData(prev => ({ ...prev, roomId: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room: Room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lockId">Lock ID</Label>
                <Input
                  id="lockId"
                  value={newLockData.lockId}
                  onChange={(e) => setNewLockData(prev => ({ ...prev, lockId: e.target.value }))}
                  placeholder="e.g., 534"
                />
              </div>

              <div>
                <Label htmlFor="lockName">Lock Name</Label>
                <Input
                  id="lockName"
                  value={newLockData.lockName}
                  onChange={(e) => setNewLockData(prev => ({ ...prev, lockName: e.target.value }))}
                  placeholder="e.g., Front Door Lock"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">How to find your Lock ID:</h4>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Open the TTLock mobile app</li>
                <li>Navigate to your lock settings</li>
                <li>Look for "Lock ID" or "Device ID" in the lock details</li>
                <li>Copy the numeric ID (e.g., "534")</li>
              </ol>
            </div>

            <Button
              onClick={handleAddLock}
              disabled={updateLockMutation.isPending}
              className="w-full"
            >
              {updateLockMutation.isPending ? "Adding Lock..." : "Add Lock Configuration"}
            </Button>
          </CardContent>
        </Card>

        {/* Environment Variables Guide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Required TTLock credentials:</p>
              <div className="space-y-1 text-sm font-mono">
                <div>TTLOCK_CLIENT_ID=your_client_id</div>
                <div>TTLOCK_CLIENT_SECRET=your_client_secret</div>
                <div>TTLOCK_USERNAME=your_ttlock_username</div>
                <div>TTLOCK_PASSWORD=your_ttlock_password</div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Note: Individual lock IDs are now configured per room in the interface above.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}