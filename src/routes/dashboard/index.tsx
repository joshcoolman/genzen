import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { checkConnections } from "@/lib/server/check-connections";
import { useRestoreDashboardRoute } from "@/lib/use-dashboard-route-memory";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

interface ConnectionStatus {
  supabase: "checking" | "connected" | "error";
  supabaseError?: string;
  fal: "checking" | "connected" | "error";
  falError?: string;
  trigger: "checking" | "connected" | "error";
  triggerError?: string;
}

function DashboardHome() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>({
    supabase: "checking",
    fal: "checking",
    trigger: "checking",
  });

  // Automatically restore the last visited dashboard route
  useRestoreDashboardRoute();

  useEffect(() => {
    async function runChecks() {
      // Check Supabase connection
      try {
        const { error } = await supabase.auth.getUser();
        if (error) {
          setStatus((s) => ({
            ...s,
            supabase: "error",
            supabaseError: error.message,
          }));
        } else {
          setStatus((s) => ({ ...s, supabase: "connected" }));
        }
      } catch (err) {
        setStatus((s) => ({
          ...s,
          supabase: "error",
          supabaseError: err instanceof Error ? err.message : "Unknown error",
        }));
      }

      // Check FAL and Trigger.dev via server function
      try {
        const serverStatus = await checkConnections();
        setStatus((s) => ({
          ...s,
          fal: serverStatus.fal.status,
          falError: serverStatus.fal.error,
          trigger: serverStatus.trigger.status,
          triggerError: serverStatus.trigger.error,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Server error";
        setStatus((s) => ({
          ...s,
          fal: "error",
          falError: errorMsg,
          trigger: "error",
          triggerError: errorMsg,
        }));
      }
    }

    if (user) {
      runChecks();
    }
  }, [user]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">Connection Status</h2>

        <div className="space-y-3">
          <StatusRow
            label="Supabase"
            status={status.supabase}
            error={status.supabaseError}
          />
          <StatusRow label="Auth" status="connected" detail={user?.email} />
          <StatusRow label="FAL" status={status.fal} error={status.falError} />
          <StatusRow
            label="Trigger.dev"
            status={status.trigger}
            error={status.triggerError}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">Environment</h2>
        <div className="text-sm space-y-2 text-muted-foreground">
          <div>
            <span className="text-muted-foreground">Supabase URL:</span>{" "}
            {import.meta.env.VITE_SUPABASE_URL}
          </div>
          <div>
            <span className="text-muted-foreground">User ID:</span> {user?.id}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  status,
  detail,
  error,
}: {
  label: string;
  status: "checking" | "connected" | "error";
  detail?: string;
  error?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
        <StatusBadge status={status} />
        {error && status === "error" && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "checking" | "connected" | "error";
}) {
  const styles = {
    checking: "bg-yellow-900/30 text-yellow-500",
    connected: "bg-accent-sage/20 text-accent-sage",
    error: "bg-red-900/30 text-red-400",
  };

  const labels = {
    checking: "Checking...",
    connected: "Connected",
    error: "Error",
  };

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
