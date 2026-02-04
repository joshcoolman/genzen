import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { checkConnections } from "@/lib/server/check-connections";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

interface ConnectionStatus {
  supabase: "checking" | "connected" | "error";
  supabaseError?: string;
  fal: "checking" | "connected" | "error";
  falError?: string;
  trigger: "checking" | "connected" | "error";
  triggerError?: string;
}

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>({
    supabase: "checking",
    fal: "checking",
    trigger: "checking",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Sign out
          </button>
        </div>

        <div className="bg-neutral-50 rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Connection Status</h2>

          <div className="space-y-3">
            <StatusRow
              label="Supabase"
              status={status.supabase}
              error={status.supabaseError}
            />
            <StatusRow label="Auth" status="connected" detail={user.email} />
            <StatusRow
              label="FAL"
              status={status.fal}
              error={status.falError}
            />
            <StatusRow
              label="Trigger.dev"
              status={status.trigger}
              error={status.triggerError}
            />
          </div>
        </div>

        <div className="bg-neutral-50 rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Environment</h2>
          <div className="text-sm space-y-2 text-neutral-600">
            <div>
              <span className="text-neutral-500">Supabase URL:</span>{" "}
              {import.meta.env.VITE_SUPABASE_URL}
            </div>
            <div>
              <span className="text-neutral-500">User ID:</span> {user.id}
            </div>
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
    <div className="flex items-center justify-between py-2 border-b border-neutral-200 last:border-0">
      <span className="text-neutral-700">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-sm text-neutral-500">{detail}</span>}
        <StatusBadge status={status} />
        {error && status === "error" && (
          <span className="text-xs text-red-500">{error}</span>
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
    checking: "bg-yellow-100 text-yellow-700",
    connected: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
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
