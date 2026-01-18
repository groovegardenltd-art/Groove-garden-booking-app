import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Key, Smartphone, User, Calendar, Clock, DoorOpen } from "lucide-react";
import { Link } from "wouter";

interface AccessLogEntry {
  unlockTime: string;
  method: string;
  passcode: string | null;
  customerName: string | null;
  roomName: string | null;
  bookingId: number | null;
  rawLog: any;
}

interface AccessLogResponse {
  logs: AccessLogEntry[];
  totalEntries: number;
  matchedEntries: number;
  dateRange: { start: string; end: string };
}

export default function AccessLog() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const [startDate, setStartDate] = useState(weekAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const { data, isLoading, refetch, isFetching } = useQuery<AccessLogResponse>({
    queryKey: ['/api/admin/access-log', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + 'T23:59:59').toISOString()
      });
      const response = await fetch(`/api/admin/access-log?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch access logs');
      return response.json();
    }
  });

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Passcode':
        return <Key className="h-4 w-4" />;
      case 'App':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <DoorOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Access Log</h1>
          <p className="text-gray-600 mt-2">View who has entered the studio and match with bookings</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Date Range</CardTitle>
            <CardDescription>Select the date range to view access logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{data.totalEntries}</div>
                <p className="text-sm text-gray-500">Total Entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{data.matchedEntries}</div>
                <p className="text-sm text-gray-500">Matched to Bookings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{data.totalEntries - data.matchedEntries}</div>
                <p className="text-sm text-gray-500">Unmatched Entries</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Entry Log</CardTitle>
            <CardDescription>
              All door entries with matched customer names from bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.logs && data.logs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Booking #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((entry, index) => {
                      const { date, time } = formatDateTime(entry.unlockTime);
                      return (
                        <TableRow key={index} className={entry.customerName ? '' : 'bg-orange-50'}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {date}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {time}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {getMethodIcon(entry.method)}
                              {entry.method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entry.customerName ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-green-500" />
                                <span className="font-medium">{entry.customerName}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.roomName || <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell>
                            {entry.bookingId ? (
                              <Badge variant="secondary">#{entry.bookingId}</Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <DoorOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No access entries found for this date range</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
