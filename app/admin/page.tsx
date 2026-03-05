"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Zap,
  Play,
  Pause,
  Eye,
  EyeOff,
} from "lucide-react";
import YouTubePlayer from "@/components/youtube-player";
import {
  getQueue,
  playNextSong,
  skipCurrentSong,
  deleteQueueEntry,
  type QueueItem,
} from "@/actions/queue-actions";
import {
  getAllUsers,
  toggleBanUser,
  verifyAdminPassword,
  getVibeLabel,
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
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tab, setTab] = useState<"queue" | "users">("queue");
  const [loading, setLoading] = useState(true);

  // Player state
  const [nowPlaying, setNowPlaying] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [vibeLabel, setVibeLabel] = useState("No Vibe Yet");
  const vibeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    const [q, u] = await Promise.all([getQueue(), getAllUsers()]);
    setQueue(q);
    setUsers(u as UserRecord[]);
    setNowPlaying(q.find((item) => item.is_now_playing) || null);
    setLoading(false);
  }, []);

  const fetchVibe = useCallback(async () => {
    const q = await getQueue();
    const nextSongs = q
      .filter((item) => !item.is_now_playing)
      .slice(0, 5)
      .map((item) => item.title);
    const label = await getVibeLabel(nextSongs);
    setVibeLabel(label);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    const init = async () => {
      await fetchData();
      if (!mounted) return;
      await fetchVibe();
    };
    init();

    vibeIntervalRef.current = setInterval(fetchVibe, 10 * 60 * 1000);

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
      .on("broadcast", { event: "play_pause" }, (payload) => {
        if (payload.payload?.action === "pause") {
          setIsPlaying(false);
        } else if (payload.payload?.action === "play") {
          setIsPlaying(true);
        } else {
          setIsPlaying((p) => !p);
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      if (vibeIntervalRef.current) clearInterval(vibeIntervalRef.current);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchData, fetchVibe]);

  // Auto-start next song if nothing is playing but there are items in the queue
  useEffect(() => {
    const unplayed = queue.filter((item) => !item.is_now_playing);
    if (!loading && !nowPlaying && unplayed.length > 0 && isAuthenticated) {
      playNextSong().then((next) => {
        if (next) {
          setNowPlaying(next);
          fetchData();
        }
      });
    }
  }, [loading, nowPlaying, queue, fetchData, isAuthenticated]);

  const handleLogin = async () => {
    setLoginLoading(true);
    const valid = await verifyAdminPassword(password);
    if (valid) {
      setIsAuthenticated(true);
      localStorage.setItem("admin_auth", "true");
    } else {
      toast.error("Wrong password");
    }
    setLoginLoading(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem("admin_auth");
    if (stored === "true") {
      setTimeout(() => setIsAuthenticated(true), 0);
    }
  }, []);

  const handleSongEnded = useCallback(async () => {
    const next = await playNextSong();
    if (next) {
      setNowPlaying(next);
      fetchData();
      fetchVibe();
    } else {
      setNowPlaying(null);
    }
  }, [fetchData, fetchVibe]);

  const handleSkip = async () => {
    await skipCurrentSong();
    toast.success("Song skipped (moved to bottom of queue)");

    const next = await playNextSong();
    if (next) {
      setNowPlaying(next);
    } else {
      setNowPlaying(null);
    }

    fetchData();
    fetchVibe();
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

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] p-4 text-white">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm rounded-2xl bg-[#181818] p-6 shadow-2xl border border-white/5"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DB954]/20">
              <Lock className="h-7 w-7 text-[#1DB954]" />
            </div>
            <h2 className="text-xl font-bold text-white">Admin Access</h2>
            <p className="mt-1 text-sm text-zinc-500">Enter Admin Password</p>
          </div>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              className="w-full rounded-xl bg-[#282828] pl-4 pr-12 py-3 text-white placeholder-zinc-500 outline-none ring-1 ring-white/5 focus:ring-[#1DB954]/50"
              autoFocus
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogin}
            disabled={loginLoading || !password}
            className="w-full rounded-full bg-[#1DB954] py-3 text-sm font-bold text-black transition-all hover:bg-[#1ed760] disabled:opacity-40"
          >
            {loginLoading ? "Verifying..." : "Login"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const unplayed = queue.filter((q) => !q.is_now_playing);

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden">
      {/* LEFT PANEL : MAIN PLAYER */}
      <div className="flex flex-1 flex-col p-6 lg:p-10 border-r border-white/5 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]">
              <Music2 className="h-5 w-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold">GYMDJ Admin Panel</h1>
          </div>

          <motion.div
            key={vibeLabel}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded-full bg-linear-to-r from-[#1DB954]/20 to-yellow-500/20 px-4 py-2 ring-1 ring-[#1DB954]/30"
          >
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">
              {vibeLabel}
            </span>
          </motion.div>
        </div>

        {/* Video Player Area */}
        <div className="flex flex-col mb-8" style={{ minHeight: "400px" }}>
          {nowPlaying ? (
            <div className="flex h-full flex-col">
              <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 group relative w-full pb-[56.25%] mb-4">
                <div className="absolute inset-0">
                  <YouTubePlayer
                    videoId={nowPlaying.video_id}
                    onEnded={handleSongEnded}
                    onError={handleSongEnded}
                    isPlaying={isPlaying}
                    autoplay
                  />
                </div>

                {/* Overlay controls */}
                <div className="absolute bottom-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-md transition-all"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={handleSkip}
                    className="bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-md transition-all border border-red-500/30 hover:border-red-500"
                  >
                    <SkipForward className="w-6 h-6 text-red-500" />
                  </button>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <h2 className="text-xl font-bold lg:text-3xl text-white">
                    {nowPlaying.title}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                    <Users className="h-4 w-4" />
                    Added by{" "}
                    <span className="text-zinc-200">
                      {nowPlaying.added_by_name}
                    </span>
                    <span className="mx-1">·</span>
                    <span
                      className={`font-bold ${
                        nowPlaying.net_score > 0
                          ? "text-[#1DB954]"
                          : nowPlaying.net_score < 0
                            ? "text-red-500"
                            : ""
                      }`}
                    >
                      {nowPlaying.net_score > 0 ? "+" : ""}
                      {nowPlaying.net_score} votes
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center justify-center h-12 w-12 rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760]"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-1" />
                    )}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSkip}
                    className="flex items-center gap-2 rounded-full bg-red-500/10 px-6 py-3 font-bold text-red-500 hover:bg-red-500 border border-red-500/20 hover:text-white transition-colors"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip Track
                  </motion.button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center flex-1 min-h-[400px] border border-dashed border-white/10 rounded-3xl">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#1DB954]/10"
              >
                <Music2 className="h-12 w-12 text-[#1DB954]" />
              </motion.div>
              <p className="text-xl font-medium text-zinc-300">
                Awaiting the next banger...
              </p>
              <p className="mt-2 text-zinc-500 max-w-sm text-center">
                The current queue is empty. Music will automatically start when
                someone queues a track.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL : ADMIN TOOLS */}
      <div className="w-96 flex flex-col bg-[#0a0a0a] shrink-0 border-l border-white/5 relative z-10">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#1DB954]" />
            <span className="font-bold text-sm tracking-widest uppercase">
              System
            </span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("admin_auth");
              setIsAuthenticated(false);
            }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/5 p-2 gap-2">
          <button
            onClick={() => setTab("queue")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "queue"
                ? "bg-[#1DB954] text-black shadow-lg"
                : "text-zinc-400 hover:bg-white/5"
            }`}
          >
            <Music2 className="h-4 w-4" />
            Up Next
          </button>
          <button
            onClick={() => setTab("users")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "users"
                ? "bg-[#1DB954] text-black shadow-lg"
                : "text-zinc-400 hover:bg-white/5"
            }`}
          >
            <Users className="h-4 w-4" />
            Users
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {tab === "queue" && (
            <AnimatePresence mode="popLayout">
              {unplayed.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-sm text-zinc-500"
                >
                  No songs in queue
                </motion.p>
              ) : (
                unplayed.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="mb-3 flex items-center gap-3 rounded-xl bg-[#181818] p-3 border border-transparent hover:border-white/10 transition-colors group"
                  >
                    <div className="text-xs font-bold text-zinc-600 w-4 text-center">
                      {index + 1}
                    </div>
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
                      <p className="truncate text-sm font-bold text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 flex justify-between pr-2 border-t border-white/5 mt-1 pt-1">
                        <span>{item.added_by_name}</span>
                        <span
                          className={`font-bold ${item.net_score > 0 ? "text-[#1DB954]" : item.net_score < 0 ? "text-red-500" : ""}`}
                        >
                          {item.net_score > 0 ? "+" : ""}
                          {item.net_score}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg bg-red-500/10 p-2 text-red-500 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Remove from queue"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          )}

          {tab === "users" && (
            <AnimatePresence mode="popLayout">
              {users.map((user) => (
                <motion.div
                  key={user.client_id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-3 flex items-center justify-between rounded-xl bg-[#181818] p-3 border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg font-bold text-white ${
                        user.is_banned ? "bg-red-500/20" : "bg-[#282828]"
                      }`}
                    >
                      <span>{user.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          user.is_banned
                            ? "text-red-400 line-through"
                            : "text-white"
                        }`}
                      >
                        {user.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase">
                        {user.gender === "male"
                          ? "��� Male"
                          : user.gender === "female"
                            ? "��� Female"
                            : "��� Unknown"}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      handleToggleBan(user.client_id, user.is_banned)
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                      user.is_banned
                        ? "border-[#1DB954]/50 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20"
                        : "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    }`}
                  >
                    {user.is_banned ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        Unban
                      </>
                    ) : (
                      <>
                        <Ban className="h-3.5 w-3.5" />
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
    </div>
  );
}
