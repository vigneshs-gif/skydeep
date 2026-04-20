import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plane, Ticket, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  formatDate,
  formatTime,
  formatDuration,
  type Flight,
} from "@/lib/flight-utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  flights: Flight | null;
};

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — SkyDeep Airlines" },
      { name: "description", content: "View your flight bookings and live flight status." },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, flights(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });

  // Realtime: any flight status update -> refetch bookings
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bookings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flights" },
        () => queryClient.invalidateQueries({ queryKey: ["bookings", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["bookings", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  if (authLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2">Sign in to view bookings</h1>
        <p className="text-sm text-muted-foreground mb-5">
          You need an account to track your flights.
        </p>
        <Button asChild className="shadow-sky">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">My bookings</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" />
              Flight status updates live
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!bookings || bookings.length === 0) && (
          <div className="bg-card rounded-2xl border border-border/60 p-12 text-center">
            <Plane className="h-10 w-10 mx-auto text-muted-foreground mb-3 -rotate-45" />
            <h3 className="font-display text-lg font-semibold mb-1">No bookings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Time for an adventure?</p>
            <Button asChild className="shadow-sky">
              <Link to="/">Search flights</Link>
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {bookings?.map((b, i) => (
            <BookingCard key={b.id} booking={b} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  const flight = booking.flights;
  if (!flight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="bg-card rounded-2xl border border-border/60 overflow-hidden hover:shadow-sky transition-shadow"
    >
      {/* Top: ticket header */}
      <div className="bg-card-gradient text-white p-5 md:p-6 relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              Booking ref
            </div>
            <div className="font-display text-2xl font-bold tracking-wider">
              {booking.booking_reference}
            </div>
          </div>
          <StatusBadge status={flight.status} />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <div className="font-display text-3xl font-bold">{formatTime(flight.departure_time)}</div>
            <div className="text-xs text-white/70">{flight.origin_code}</div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-white/60">
              {formatDuration(flight.departure_time, flight.arrival_time)}
            </span>
            <div className="relative w-full h-px bg-white/30">
              <Plane className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 text-sky-glow rotate-90" />
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-bold">{formatTime(flight.arrival_time)}</div>
            <div className="text-xs text-white/70">{flight.destination_code}</div>
          </div>
        </div>
      </div>

      {/* Bottom details */}
      <div className="p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Detail icon={Calendar} label="Date" value={formatDate(flight.departure_time)} />
        <Detail icon={MapPin} label="Gate" value={flight.gate ? `${flight.gate} · T${flight.terminal ?? "-"}` : "TBA"} />
        <Detail icon={Ticket} label="Seat" value={`${booking.seat_number} · ${booking.seat_class}`} />
        <Detail icon={Plane} label="Flight" value={flight.flight_number} />
      </div>
    </motion.div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1 mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-display font-semibold capitalize">{value}</div>
    </div>
  );
}
