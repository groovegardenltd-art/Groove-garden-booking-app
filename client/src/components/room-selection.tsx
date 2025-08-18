import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Room } from "@shared/schema";

interface RoomSelectionProps {
  rooms: Room[];
  selectedRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  bookedRooms?: number[];
}

export function RoomSelection({ 
  rooms, 
  selectedRoom, 
  onRoomSelect, 
  bookedRooms = [] 
}: RoomSelectionProps) {
  const getRoomStatus = (room: Room) => {
    if (bookedRooms.includes(room.id)) {
      return { label: "Occupied", color: "bg-red-100 text-red-800" };
    }
    if (selectedRoom?.id === room.id) {
      return { label: "Selected", color: "bg-music-indigo text-white" };
    }
    return { label: "Available", color: "bg-green-100 text-green-800" };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Rooms</h3>
      
      <div className="space-y-4">
        {rooms.map((room) => {
          const status = getRoomStatus(room);
          const isOccupied = bookedRooms.includes(room.id);
          const isSelected = selectedRoom?.id === room.id;
          
          return (
            <Card
              key={room.id}
              className={`cursor-pointer transition-colors ${
                isOccupied 
                  ? "opacity-60 cursor-not-allowed" 
                  : isSelected
                  ? "border-music-indigo bg-music-indigo/5"
                  : "border-gray-200 hover:border-music-indigo"
              }`}
              onClick={() => !isOccupied && onRoomSelect(room)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{room.name}</h4>
                  <Badge className={`text-xs px-2 py-1 ${status.color}`}>
                    {status.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{room.description}</p>
                <div>
                  <span className={`font-semibold ${isOccupied ? "text-gray-400" : "text-music-purple"}`}>
                    {(room as any).dayPricePerHour ? (
                      <div className="text-xs">
                        <div>£{parseFloat((room as any).dayPricePerHour)}/hr (9am-5pm)</div>
                        <div>£{parseFloat((room as any).eveningPricePerHour)}/hr (5pm-midnight)</div>
                      </div>
                    ) : (
                      `£${room.pricePerHour}/hour`
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedRoom && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">{selectedRoom.name} Equipment</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            {selectedRoom.equipment.map((item, index) => (
              <li key={index} className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
