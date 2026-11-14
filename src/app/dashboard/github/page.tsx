"use client";

import { useEffect, useState } from "react";

export default function GitHubPage() {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/github/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) {
          setConnected(true);
          setUsername(d.github_username);
        }
      });
  }, []);

  async function connect() {
    setLoading(true);
    const res = await fetch("/api/github/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (res.ok) {
      setConnected(true);
      setUsername(data.username);
      setToken("");
    } else {
      alert(data.error);
    }
    setLoading(false);
  }

  async function disconnect() {
    await fetch("/api/github/connect", { method: "DELETE" });
    setConnected(false);
    setUsername("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">GitHub Connection</h1>
      {connected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <p>Connected as <strong>{username}</strong></p>
          <button onClick={disconnect} className="bg-red-600 px-4 py-2 rounded">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="GitHub Personal Access Token"
            className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2"
          />
          <button
            onClick={connect}
            disabled={loading}
            className="bg-green-600 px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect GitHub"}
          </button>
        </div>
      )}
    </div>
  );
}
