"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Trash2,
  SkipForward,
  Ban,
  UserCheck,
  Lock,
  Music2,
  Users,
  LogOut,
} from "lucide-react";
import {
  getQueue,
  skipCurrentSong,
  deleteQueueEntry,
  type QueueItem,
} from "@/actions/queue-actions";
import {
  getAllUsers,
  toggleBanUser,
  verifyAdminPassword,
} from "@/actions/user-actions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Image from "next/image";

type UserRecord = {
  id: string;
  name: string;
  gender: string;
  client_id: string;
  is_banned: boolean;
  created_at: string;
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tab, setTab] = useState<"queue" | "users">("queue");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [q, u] = await Promise.all([getQueue(), getAllUsers()]);
    setQueue(q);
    setUsers(u as UserRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    const init = async () => {
      const [q, u] = await Promise.all([getQueue(), getAllUsers()]);
      if (!mounted) return;
      setQueue(q);
      setUsers(u as UserRecord[]);
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel("admin-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchData]);

  const handleLogin = async () => {
    setLoginLoading(true);
    const valid = await verifyAdminPassword(password);
    if (valid) {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      toast.error("Wrong password");
    }
    setLoginLoading(false);
  };

  // Check session on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("admin_auth");
    if (stored === "true") {
      // Using startTransition to avoid the "setState in effect" warning
      // This is a valid use case - reading external storage on mount
      setTimeout(() => setIsAuthenticated(true), 0);
    }
  }, []);

  const handleSkip = async () => {
    await skipCurrentSong();
    toast.success("Song skipped");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await deleteQueueEntry(id);
    toast.success("Entry deleted");
    fetchData();
  };

  const handleToggleBan = async (
    clientId: string,
    currentlyBanned: boolean,
  ) => {
    await toggleBanUser(clientId, !currentlyBanned);
    toast.success(currentlyBanned ? "User unbanned" : "User banned");
    fetchData();
  };

  // ─── Login Screen ────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm rounded-2xl bg-[#181818] p-6 shadow-2xl border border-white/5"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
              <Lock className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Admin Login</h2>
            <p className="mt-1 text-sm text-zinc-500">Enter admin password</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
            className="mb-4 w-full rounded-xl bg-[#282828] px-4 py-3 text-white placeholder-zinc-500 outline-none ring-1 ring-white/5 focus:ring-red-500/50"
            autoFocus
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogin}
            disabled={loginLoading || !password}
            className="w-full rounded-full bg-red-500 py-3 text-sm font-bold text-white transition-all hover:bg-red-600 disabled:opacity-40"
          >
            {loginLoading ? "Verifying..." : "Login"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ─── Admin Dashboard ─────────────────────────────
  const nowPlaying = queue.find((q) => q.is_now_playing);
  const unplayed = queue.filter((q) => !q.is_now_playing);

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0a0a] px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-red-500" />
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              sessionStorage.removeItem("admin_auth");
              setIsAuthenticated(false);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[#282828] px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </motion.button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-4">
        {/* Kill Switch */}
        {nowPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={nowPlaying.thumbnail}
                    alt={nowPlaying.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div>
                  <p className="text-xs text-red-400 font-bold uppercase tracking-wider">
                    Now Playing
                  </p>
                  <p className="text-sm font-medium truncate max-w-50">
                    {nowPlaying.title}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSkip}
                className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {(["queue", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t
                  ? "bg-[#1DB954] text-black"
                  : "bg-[#282828] text-zinc-400 hover:text-white"
              }`}
            >
              {t === "queue" ? (
                <Music2 className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {t === "queue" ? "Queue" : "Users"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[#181818] animate-pulse"
              />
            ))}
          </div>
        ) : tab === "queue" ? (
          /* ─── Queue Management ─── */
          <AnimatePresence mode="popLayout">
            {unplayed.length === 0 ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center text-sm text-zinc-500"
              >
                Queue is empty
              </motion.p>
            ) : (
              unplayed.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="mb-2 flex items-center gap-3 rounded-xl bg-[#181818] p-3"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      {item.added_by_name} · Score: {item.net_score}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg bg-red-500/20 p-2 text-red-400 hover:bg-red-500/30 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        ) : (
          /* ─── User Management ─── */
          <AnimatePresence mode="popLayout">
            {users.map((user) => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2 flex items-center gap-3 rounded-xl bg-[#181818] p-3"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                    user.is_banned
                      ? "bg-red-500/20 text-red-400"
                      : "bg-[#1DB954]/20 text-[#1DB954]"
                  }`}
                >
                  {user.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {user.name}
                    {user.is_banned && (
                      <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                        BANNED
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {user.gender} ·{" "}
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() =>
                    handleToggleBan(user.client_id, user.is_banned)
                  }
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    user.is_banned
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                >
                  {user.is_banned ? (
                    <>
                      <UserCheck className="h-3 w-3" />
                      Unban
                    </>
                  ) : (
                    <>
                      <Ban className="h-3 w-3" />
                      Ban
                    </>
                  )}
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
