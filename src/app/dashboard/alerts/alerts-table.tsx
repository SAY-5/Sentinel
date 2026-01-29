"use client";

import { useState } from "react";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { formatDistanceToNow } from "@/lib/format";
import type { Alert } from "@/server/db/schema";

interface AlertsTableProps {
  alerts: Alert[];
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "acknowledged" | "unacknowledged"
  >("all");

  const filtered = alerts.filter((a) => {
    if (filter !== "all" && a.severity !== filter) return false;
    if (statusFilter === "acknowledged" && !a.acknowledgedAt) return false;
    if (statusFilter === "unacknowledged" && a.acknowledgedAt) return false;
    return true;
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-4 border-b border-zinc-800 p-4">
        <div className="flex gap-2">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === "critical"}
            onClick={() => setFilter("critical")}
          >
            Critical
          </FilterButton>
          <FilterButton
            active={filter === "warning"}
            onClick={() => setFilter("warning")}
          >
            Warning
          </FilterButton>
          <FilterButton
            active={filter === "info"}
            onClick={() => setFilter("info")}
          >
            Info
          </FilterButton>
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        <div className="flex gap-2">
          <FilterButton
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            All Status
          </FilterButton>
          <FilterButton
            active={statusFilter === "unacknowledged"}
            onClick={() => setStatusFilter("unacknowledged")}
          >
            Unacknowledged
          </FilterButton>
          <FilterButton
            active={statusFilter === "acknowledged"}
            onClick={() => setStatusFilter("acknowledged")}
          >
            Acknowledged
          </FilterButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          No alerts match the current filters
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Rule</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Triggered</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface AlertRowProps {
  alert: Alert;
}

function AlertRow({ alert }: AlertRowProps) {
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(!!alert.acknowledgedAt);

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/acknowledge`, {
        method: "POST",
      });
      if (res.ok) {
        setAcknowledged(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-b border-zinc-800 last:border-0">
      <td className="px-4 py-3">
        <SeverityBadge
          severity={alert.severity as "critical" | "warning" | "info"}
        />
      </td>
      <td className="px-4 py-3 text-sm font-mono text-zinc-400">
        {alert.ruleName}
      </td>
      <td className="px-4 py-3 text-sm max-w-md">
        <span className="block truncate" title={alert.title}>
          {alert.title}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">
        {formatDistanceToNow(alert.triggeredAt)}
      </td>
      <td className="px-4 py-3 text-sm">
        {acknowledged ? (
          <span className="text-green-400">Acknowledged ✓</span>
        ) : (
          <span className="text-zinc-500">Pending</span>
        )}
      </td>
      <td className="px-4 py-3">
        {!acknowledged && (
          <button
            onClick={handleAcknowledge}
            disabled={loading}
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "..." : "Acknowledge"}
          </button>
        )}
      </td>
    </tr>
  );
}

interface FilterButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function FilterButton({ children, active, onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-zinc-700 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}
