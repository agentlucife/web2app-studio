"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInGitHub() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function connectPAT(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">Web2App Studio</h1>
        <p className="text-gray-400 text-center">Convert websites into native apps</p>

        <button
          onClick={signInGitHub}
          className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200"
        >
          Sign in with GitHub
        </button>

        <div className="relative text-center text-gray-500">
          <span className="bg-gray-950 px-2">or connect with PAT</span>
        </div>

        <form onSubmit={connectPAT} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="GitHub Personal Access Token"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 text-black font-semibold py-3 rounded-lg hover:bg-green-400 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect GitHub"}
          </button>
        </form>
      </div>
    </div>
  );
}
