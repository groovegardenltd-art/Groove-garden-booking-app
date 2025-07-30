import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Lock, CheckCircle, XCircle } from "lucide-react";
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

  // Fetch rooms
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["/api/rooms"],
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
              >
                {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
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