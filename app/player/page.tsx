"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Zap, SkipForward, Users } from "lucide-react";
import YouTubePlayer from "@/components/youtube-player";
import {
  getNowPlaying,
  getQueue,
  playNextSong,
  type QueueItem,
} from "@/actions/queue-actions";
import { getVibeLabel } from "@/actions/user-actions";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function PlayerPage() {
  const [nowPlaying, setNowPlaying] = useState<QueueItem | null>(null);
  const [upNext, setUpNext] = useState<QueueItem[]>([]);
  const [vibeLabel, setVibeLabel] = useState("No Vibe Yet");
  const [loading, setLoading] = useState(true);
  const vibeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchState = useCallback(async () => {
    const [current, queue] = await Promise.all([getNowPlaying(), getQueue()]);
    setNowPlaying(current);
    setUpNext(queue.filter((q) => !q.is_now_playing).slice(0, 10));
    setLoading(false);
  }, []);

  // Fetch vibe label
  const fetchVibe = useCallback(async () => {
    const queue = await getQueue();
    const nextSongs = queue
      .filter((q) => !q.is_now_playing)
      .slice(0, 5)
      .map((q) => q.title);
    const label = await getVibeLabel(nextSongs);
    setVibeLabel(label);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const [current, queue] = await Promise.all([getNowPlaying(), getQueue()]);
      if (!mounted) return;
      setNowPlaying(current);
      setUpNext(queue.filter((q) => !q.is_now_playing).slice(0, 10));
      setLoading(false);

      const nextSongs = queue
        .filter((q) => !q.is_now_playing)
        .slice(0, 5)
        .map((q) => q.title);
      const label = await getVibeLabel(nextSongs);
      if (mounted) setVibeLabel(label);
    };

    init();

    // Update vibe every 10 minutes
    vibeIntervalRef.current = setInterval(fetchVibe, 10 * 60 * 1000);

    return () => {
      mounted = false;
      if (vibeIntervalRef.current) clearInterval(vibeIntervalRef.current);
    };
  }, [fetchVibe]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("player-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          fetchState();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          fetchState();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchState]);

  const handleSongEnded = useCallback(async () => {
    const next = await playNextSong();
    if (next) {
      setNowPlaying(next);
      fetchState();
      fetchVibe();
    } else {
      setNowPlaying(null);
    }
  }, [fetchState, fetchVibe]);

  // Auto-start first song if nothing is playing
  useEffect(() => {
    if (!loading && !nowPlaying && upNext.length > 0) {
      playNextSong().then((next) => {
        if (next) {
          setNowPlaying(next);
          fetchState();
        }
      });
    }
  }, [loading, nowPlaying, upNext.length, fetchState]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-12 w-12 rounded-full border-3 border-[#1DB954] border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden">
      {/* Main Player Area */}
      <div className="flex flex-1 flex-col p-6 lg:p-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]">
              <Music2 className="h-5 w-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold">GYMDJ</h1>
          </div>

          {/* Vibe Label */}
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

        {/* Video Player */}
        <div className="flex-1">
          {nowPlaying ? (
            <div className="flex h-full flex-col">
              <div className="flex-1">
                <YouTubePlayer
                  videoId={nowPlaying.video_id}
                  onEnded={handleSongEnded}
                  autoplay
                />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4"
              >
                <h2 className="text-xl font-bold lg:text-2xl">
                  {nowPlaying.title}
                </h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="h-4 w-4" />
                  Added by {nowPlaying.added_by_name}
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
              </motion.div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[#1DB954]/10"
              >
                <Music2 className="h-12 w-12 text-[#1DB954]" />
              </motion.div>
              <p className="text-lg font-medium text-zinc-400">
                Waiting for songs...
              </p>
              <p className="text-sm text-zinc-600">
                Add songs from your phone to get started
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Next Up */}
      <div className="hidden w-80 shrink-0 border-l border-white/5 bg-[#0a0a0a] p-6 lg:block xl:w-96">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <SkipForward className="h-5 w-5 text-[#1DB954]" />
          Next Up
        </h3>

        {upNext.length === 0 ? (
          <p className="text-sm text-zinc-600">No songs in queue</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {upNext.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 rounded-xl bg-[#181818] p-3 transition-colors hover:bg-[#1f1f1f]"
                >
                  <span className="w-5 text-center text-xs font-bold text-zinc-600">
                    {index + 1}
                  </span>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {item.added_by_name} · {item.duration}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      item.net_score > 0
                        ? "text-[#1DB954]"
                        : item.net_score < 0
                          ? "text-red-500"
                          : "text-zinc-500"
                    }`}
                  >
                    {item.net_score > 0 ? "+" : ""}
                    {item.net_score}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
