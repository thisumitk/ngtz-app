"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Unlink, Trash2, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/navbar";

type AccountData = {
  user: { name: string | null; email: string; image: string | null };
  providers: { provider: string; providerAccountId: string }[];
};

const PROVIDER_META: Record<string, { label: string; icon: React.ReactNode }> = {
  google: {
    label: "Google",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  github: {
    label: "GitHub",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
};

export default function SettingsPage() {
  const { status } = useSession();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "unauthenticated") redirect("/login");

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      if (res.ok) setAccount(await res.json());
    } catch {
      // silently fail — page still renders with session data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleUnlink = async (provider: string) => {
    setUnlinking(provider);
    setError(null);
    try {
      const res = await fetch(`/api/account/providers/${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to unlink provider");
        return;
      }
      await fetchAccount();
    } catch {
      setError("Failed to unlink provider");
    } finally {
      setUnlinking(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete account");
        setDeleting(false);
        return;
      }
      signOut({ callbackUrl: "/login" });
    } catch {
      setError("Failed to delete account");
      setDeleting(false);
    }
  };

  const pageLoading = loading || status === "loading";

  return (
    <div className="min-h-screen bg-ngtz-bg">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-200 font-display mb-6">
          Settings
        </h1>

        {pageLoading && (
          <div className="text-center text-ngtz-muted text-sm font-mono py-12">
            Loading...
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-400 font-mono">
            {error}
          </div>
        )}

        {!pageLoading && account && (
          <>
            {/* Section A: Profile */}
            <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-5 mb-4">
              <h2 className="text-[10px] text-ngtz-muted font-mono tracking-wider mb-4">
                PROFILE
              </h2>
              <div className="flex items-center gap-4">
                {account.user.image && (
                  <img
                    src={account.user.image}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  {account.user.name && (
                    <div className="text-sm text-gray-200 font-display">
                      {account.user.name}
                    </div>
                  )}
                  <div className="text-xs text-ngtz-muted font-mono">
                    {account.user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Linked Accounts */}
            <div className="bg-ngtz-card border border-ngtz-border rounded-xl p-5 mb-4">
              <h2 className="text-[10px] text-ngtz-muted font-mono tracking-wider mb-4">
                LINKED ACCOUNTS
              </h2>
              <div className="space-y-3">
                {account.providers.map((p) => {
                  const meta = PROVIDER_META[p.provider];
                  const isOnly = account.providers.length <= 1;
                  return (
                    <div
                      key={p.provider}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">
                          {meta?.icon ?? p.provider}
                        </span>
                        <span className="text-sm text-gray-300 font-mono">
                          {meta?.label ?? p.provider}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnlink(p.provider)}
                        disabled={isOnly || unlinking === p.provider}
                        title={
                          isOnly
                            ? "Cannot unlink your only login method"
                            : `Unlink ${meta?.label ?? p.provider}`
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
                                   text-[#555] hover:text-red-400 hover:bg-red-500/10
                                   disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#555] disabled:hover:bg-transparent
                                   transition-all"
                      >
                        <Unlink size={12} />
                        {unlinking === p.provider ? "Unlinking..." : "Unlink"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section C: Danger Zone */}
            <div className="bg-ngtz-card border border-red-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-red-400" />
                <h2 className="text-[10px] text-red-400 font-mono tracking-wider">
                  DANGER ZONE
                </h2>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono
                             text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 size={14} />
                  Delete Account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#888] font-mono">
                    This will permanently delete all your data. Type{" "}
                    <span className="text-red-400">DELETE</span> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-ngtz-border
                               text-sm text-gray-200 font-mono placeholder:text-[#333]
                               focus:outline-none focus:border-red-500/40"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirm !== "DELETE" || deleting}
                      className="px-4 py-2 rounded-lg text-xs font-mono
                                 bg-red-500/20 text-red-400 border border-red-500/30
                                 hover:bg-red-500/30 transition-all
                                 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Deleting..." : "Confirm Delete"}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirm("");
                      }}
                      className="px-4 py-2 rounded-lg text-xs font-mono
                                 text-[#555] hover:text-[#888] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
