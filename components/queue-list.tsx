"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Music2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { getQueue, type QueueItem } from "@/actions/queue-actions";
import {
  castVote,
  removeVote,
  getUserVotes,
  type VoteType,
} from "@/actions/vote-actions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Image from "next/image";

type Props = {
  clientId: string;
};

export default function QueueList({ clientId }: Props) {
  const t = useTranslations("queue");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteType>>({});
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    const data = await getQueue();
    setQueue(data);
    setLoading(false);
  }, []);

  const fetchVotes = useCallback(async () => {
    const votes = await getUserVotes(clientId);
    setUserVotes(votes);
  }, [clientId]);

  // Initial load
  useEffect(() => {
    fetchQueue();
    fetchVotes();
  }, [fetchQueue, fetchVotes]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => {
          fetchQueue();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          fetchQueue();
          fetchVotes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue, fetchVotes]);

  const handleVote = async (queueId: string, voteType: VoteType) => {
    setVotingId(queueId);

    try {
      // If user already voted the same way, remove vote
      if (userVotes[queueId] === voteType) {
        await removeVote({ queueId, clientId });
        setUserVotes((prev) => {
          const copy = { ...prev };
          delete copy[queueId];
          return copy;
        });
      } else {
        const res = await castVote({ queueId, clientId, voteType });
        if (res.error) {
          toast.error(res.error);
        } else {
          setUserVotes((prev) => ({ ...prev, [queueId]: voteType }));
        }
      }
      await fetchQueue();
    } catch {
      toast.error("Vote failed");
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl bg-[#181818] p-3 animate-pulse"
          >
            <div className="h-14 w-14 rounded-lg bg-[#282828]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[#282828]" />
              <div className="h-3 w-1/3 rounded bg-[#282828]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unplayed = queue.filter((q) => !q.is_now_playing);
  const nowPlaying = queue.find((q) => q.is_now_playing);

  return (
    <div className="w-full">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
        <Music2 className="h-5 w-5 text-[#1DB954]" />
        {t("title")}
      </h2>

      {/* Now Playing */}
      {nowPlaying && (
        <motion.div
          layout
          className="mb-4 rounded-xl border border-[#1DB954]/30 bg-[#1DB954]/10 p-3"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#1DB954]">
            {t("nowPlaying")}
          </p>
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {nowPlaying.title}
              </p>
              <p className="text-xs text-zinc-400">
                {t("addedBy", { name: nowPlaying.added_by_name })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`text-sm font-bold ${
                  nowPlaying.net_score > 0
                    ? "text-[#1DB954]"
                    : nowPlaying.net_score < 0
                      ? "text-red-500"
                      : "text-zinc-400"
                }`}
              >
                {nowPlaying.net_score > 0 ? "+" : ""}
                {nowPlaying.net_score}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Queue */}
      {unplayed.length === 0 && !nowPlaying ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <Music2 className="mb-3 h-12 w-12 text-zinc-700" />
          <p className="text-sm text-zinc-500">{t("empty")}</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          {unplayed.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              className="mb-2 flex items-center gap-3 rounded-xl bg-[#181818] p-3 transition-colors hover:bg-[#1f1f1f]"
            >
              {/* Vote Buttons */}
              <div className="flex flex-col items-center gap-0.5">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleVote(item.id, 1)}
                  disabled={votingId === item.id}
                  className={`rounded-md p-1 transition-colors ${
                    userVotes[item.id] === 1
                      ? "text-[#1DB954] bg-[#1DB954]/20"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ChevronUp className="h-4 w-4" />
                </motion.button>

                <span
                  className={`text-xs font-bold tabular-nums ${
                    item.net_score > 0
                      ? "text-[#1DB954]"
                      : item.net_score < 0
                        ? "text-red-500"
                        : "text-zinc-400"
                  }`}
                >
                  {item.net_score}
                </span>

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleVote(item.id, -1)}
                  disabled={votingId === item.id}
                  className={`rounded-md p-1 transition-colors ${
                    userVotes[item.id] === -1
                      ? "text-red-500 bg-red-500/20"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Thumbnail */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {item.title}
                </p>
                <p className="flex items-center gap-1 text-xs text-zinc-500">
                  <User className="h-3 w-3" />
                  {item.added_by_name} · {item.duration}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
