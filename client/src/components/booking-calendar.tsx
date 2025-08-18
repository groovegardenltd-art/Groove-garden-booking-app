import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Room } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface BookingCalendarProps {
  selectedRoom: Room | null;
  selectedDate: string | null;
  selectedTime: string | null;
  selectedDuration: number;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
  onDurationChange: (duration: number) => void;
}

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
}

const BUSINESS_HOURS = [
  { time: "06:00", label: "6:00 AM" },
  { time: "07:00", label: "7:00 AM" },
  { time: "08:00", label: "8:00 AM" },
  { time: "09:00", label: "9:00 AM" },
  { time: "10:00", label: "10:00 AM" },
  { time: "11:00", label: "11:00 AM" },
  { time: "12:00", label: "12:00 PM" },
  { time: "13:00", label: "1:00 PM" },
  { time: "14:00", label: "2:00 PM" },
  { time: "15:00", label: "3:00 PM" },
  { time: "16:00", label: "4:00 PM" },
  { time: "17:00", label: "5:00 PM" },
  { time: "18:00", label: "6:00 PM" },
  { time: "19:00", label: "7:00 PM" },
  { time: "20:00", label: "8:00 PM" },
  { time: "21:00", label: "9:00 PM" },
  { time: "22:00", label: "10:00 PM" },
  { time: "23:00", label: "11:00 PM" },
];

export function BookingCalendar({
  selectedRoom,
  selectedDate,
  selectedTime,
  selectedDuration,
  onDateSelect,
  onTimeSelect,
  onDurationChange,
}: BookingCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Get the start of the current week (Monday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const weekStart = getWeekStart(currentWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric' 
    });
  };

  const getWeekRange = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${start.getFullYear()}`;
  };

  // Fetch availability for selected room and date
  const { data: availability } = useQuery({
    queryKey: [`/api/rooms/${selectedRoom?.id}/availability?date=${selectedDate}`, selectedDate],
    enabled: !!selectedRoom && !!selectedDate,
  });

  const isTimeSlotAvailable = (time: string, duration: number) => {
    if (!availability || !(availability as any).bookedSlots) return true;
    
    // Check if the time slot and the next (duration-1) hours are available
    for (let i = 0; i < duration; i++) {
      const currentHour = parseInt(time.split(':')[0]) + i;
      const checkTime = `${currentHour.toString().padStart(2, '0')}:00`;
      
      // Check if this hour is booked
      const isBooked = (availability as any).bookedSlots.some((slot: { startTime: string; endTime: string }) => {
        return checkTime >= slot.startTime && checkTime < slot.endTime;
      });
      
      if (isBooked) return false;
      
      // Check if we're going beyond business hours
      if (currentHour >= 23) return false;
    }
    
    return true;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (date: Date) => {
    if (!isPastDate(date)) {
      onDateSelect(formatDate(date));
    }
  };

  const handleTimeClick = (time: string) => {
    if (selectedRoom && selectedDate && isTimeSlotAvailable(time, selectedDuration)) {
      onTimeSelect(time);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Duration Selection */}
      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center gap-4">
          <Clock className="h-5 w-5 text-purple-600" />
          <div className="flex-1">
            <Label htmlFor="duration" className="text-sm font-medium text-purple-800">
              Session Duration
            </Label>
            <Select value={selectedDuration.toString()} onValueChange={(value) => onDurationChange(parseInt(value))}>
              <SelectTrigger className="w-48 mt-1">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Hour</SelectItem>
                <SelectItem value="2">2 Hours</SelectItem>
                <SelectItem value="3">3 Hours</SelectItem>
                <SelectItem value="4">4 Hours</SelectItem>
                <SelectItem value="5">5 Hours</SelectItem>
                <SelectItem value="6">6 Hours</SelectItem>
                <SelectItem value="7">7 Hours</SelectItem>
                <SelectItem value="8">8 Hours</SelectItem>
                <SelectItem value="9">9 Hours</SelectItem>
                <SelectItem value="10">10 Hours</SelectItem>
                <SelectItem value="11">11 Hours</SelectItem>
                <SelectItem value="12">12 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-purple-700">
            <span className="font-medium">
              {selectedDuration} hour{selectedDuration > 1 ? 's' : ''} selected
              {selectedDuration > 4 && (
                <span className="block text-green-600">10% discount applied!</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Select Date & Time</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 px-4">
            {getWeekRange()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Calendar Days Header */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="p-2"></div>
            {weekDays.map((date, index) => {
              const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const isSelected = selectedDate === formatDate(date);
              const past = isPastDate(date);
              
              return (
                <div
                  key={index}
                  className={`p-2 text-center text-sm font-medium cursor-pointer rounded transition-colors ${
                    isSelected
                      ? "bg-music-indigo text-white"
                      : past
                      ? "text-gray-400"
                      : isToday(date)
                      ? "text-music-purple"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => handleDateClick(date)}
                >
                  {dayNames[index]}
                  <br />
                  <span className="text-xs">{date.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Time Slots */}
          {selectedRoom && selectedDate && (
            <div className="space-y-1">
              {BUSINESS_HOURS.map((hour) => (
                <div key={hour.time} className="grid grid-cols-8 gap-1">
                  <div className="p-2 text-sm text-gray-600 font-medium">
                    {hour.label}
                  </div>
                  {weekDays.map((date, dayIndex) => {
                    const dateStr = formatDate(date);
                    const isAvailable = dateStr === selectedDate ? isTimeSlotAvailable(hour.time, selectedDuration) : true;
                    const isSelectedSlot = selectedDate === dateStr && selectedTime === hour.time;
                    const isPast = isPastDate(date);
                    const isClosed = date.getDay() === 0; // Sunday
                    
                    let buttonClass = "p-2 border rounded text-sm transition-colors ";
                    let buttonText = "Available";
                    let disabled = false;

                    if (isClosed) {
                      buttonClass += "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed";
                      buttonText = "Closed";
                      disabled = true;
                    } else if (isPast) {
                      buttonClass += "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed";
                      buttonText = "Past";
                      disabled = true;
                    } else if (!isAvailable && dateStr === selectedDate) {
                      buttonClass += "bg-red-100 border-red-200 text-red-700 cursor-not-allowed";
                      buttonText = selectedDuration > 1 ? `${selectedDuration}h blocked` : "Booked";
                      disabled = true;
                    } else if (isSelectedSlot) {
                      buttonClass += "bg-music-indigo border-music-indigo text-white";
                      buttonText = "Selected";
                    } else if (dateStr === selectedDate) {
                      buttonClass += "border-gray-200 hover:bg-music-indigo hover:text-white";
                    } else {
                      buttonClass += "border-gray-200 text-gray-400";
                      disabled = true;
                    }

                    return (
                      <button
                        key={`${dateStr}-${hour.time}`}
                        className={buttonClass}
                        disabled={disabled}
                        onClick={() => !disabled && dateStr === selectedDate && handleTimeClick(hour.time)}
                      >
                        {buttonText}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {!selectedRoom && (
            <div className="text-center py-8 text-gray-500">
              Select a room to view available time slots
            </div>
          )}

          {selectedRoom && !selectedDate && (
            <div className="text-center py-8 text-gray-500">
              Select a date to view available time slots
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
