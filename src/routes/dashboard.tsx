import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useDashboardRouteMemory } from "@/lib/use-dashboard-route-memory";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayoutRoute,
});

function DashboardLayoutRoute() {
  const { user, loading } = useAuth();

  // Remember the last visited dashboard route
  useDashboardRouteMemory();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
