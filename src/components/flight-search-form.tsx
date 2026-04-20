import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeftRight, Calendar, MapPin, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const POPULAR_AIRPORTS = [
  { code: "JFK", city: "New York" },
  { code: "LAX", city: "Los Angeles" },
  { code: "SFO", city: "San Francisco" },
  { code: "ORD", city: "Chicago" },
  { code: "MIA", city: "Miami" },
  { code: "SEA", city: "Seattle" },
  { code: "BOS", city: "Boston" },
];

export function FlightSearchForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [from, setFrom] = useState("JFK");
  const [to, setTo] = useState("LAX");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [passengers, setPassengers] = useState("1");

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/search",
      search: { from, to, date, passengers: Number(passengers) },
    });
  };

  return (
    <form
      onSubmit={handleSearch}
      className={`bg-card rounded-2xl shadow-sky-lg border border-border/50 p-4 md:p-6 ${
        compact ? "" : "backdrop-blur-xl"
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_auto_auto] gap-3 items-end">
        {/* From */}
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> From
          </Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="from" className="h-12 font-display text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_AIRPORTS.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  <span className="font-display font-semibold">{a.code}</span>
                  <span className="text-muted-foreground ml-2 text-sm">{a.city}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Swap */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={swap}
          className="hidden md:flex mb-0.5 hover:bg-accent/10 hover:text-accent rounded-full"
          aria-label="Swap origin and destination"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>

        {/* To */}
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> To
          </Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger id="to" className="h-12 font-display text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_AIRPORTS.map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  <span className="font-display font-semibold">{a.code}</span>
                  <span className="text-muted-foreground ml-2 text-sm">{a.city}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Departure
          </Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={format(new Date(), "yyyy-MM-dd")}
            className="h-12 font-display"
          />
        </div>

        {/* Passengers */}
        <div className="space-y-1.5">
          <Label htmlFor="pax" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Pax
          </Label>
          <Select value={passengers} onValueChange={setPassengers}>
            <SelectTrigger id="pax" className="h-12 font-display w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Submit */}
        <Button type="submit" size="lg" className="h-12 px-6 shadow-sky font-display gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>
    </form>
  );
}
