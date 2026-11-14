"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState({ projects: 0, builds: 0, running: 0, failed: 0 });

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, projects: d.projects?.length || 0 })))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Projects", value: stats.projects },
          { label: "Builds", value: stats.builds },
          { label: "Running", value: stats.running },
          { label: "Failed", value: stats.failed },
        ].map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">{c.label}</p>
            <p className="text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
