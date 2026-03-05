"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, Plus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { searchYouTube, type SearchResult } from "@/actions/search-actions";
import { addToQueue } from "@/actions/queue-actions";
import { toast } from "sonner";
import Image from "next/image";

type Props = {
  clientId: string;
  userName: string;
};

export default function SearchBar({ clientId, userName }: Props) {
  const t = useTranslations("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setSearched(true);
        startTransition(async () => {
          const data = await searchYouTube(query.trim());
          setResults(data);
        });
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearched(true);
    startTransition(async () => {
      const data = await searchYouTube(query.trim());
      setResults(data);
    });
  };

  const handleAdd = async (result: SearchResult) => {
    setAddingId(result.videoId);
    try {
      const res = await addToQueue({
        videoId: result.videoId,
        title: result.title,
        thumbnail: result.thumbnail,
        duration: result.duration,
        clientId,
        userName,
      });

      if (res.error) {
        if (res.error === "limit_reached") {
          toast.error(t("limitReached"));
        } else if (res.error === "already_in_queue") {
          toast.error(t("alreadyInQueue"));
        } else {
          toast.error(res.error);
        }
      } else {
        toast.success(t("addedToQueue"));
        // Remove from results after adding
        setResults((prev) => prev.filter((r) => r.videoId !== result.videoId));
      }
    } catch {
      toast.error("Failed to add song");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("placeholder")}
          className="w-full rounded-xl bg-[#282828] py-3 pl-10 pr-10 text-white placeholder-zinc-500 outline-none ring-1 ring-white/5 transition-all focus:ring-[#1DB954]/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setSearched(false);
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl bg-[#181818] p-3 animate-pulse"
              >
                <div className="h-16 w-24 rounded-lg bg-[#282828]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[#282828]" />
                  <div className="h-3 w-1/4 rounded bg-[#282828]" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {!isPending && searched && results.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center text-sm text-zinc-500"
          >
            {t("noResults")}
          </motion.p>
        )}

        {!isPending &&
          results.map((result, index) => (
            <motion.div
              key={result.videoId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.05 }}
              className="mb-2 flex items-center gap-3 rounded-xl bg-[#181818] p-3 transition-colors hover:bg-[#1f1f1f]"
            >
              {/* Thumbnail */}
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={result.thumbnail}
                  alt={result.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 text-[9px] text-white">
                  <Clock className="h-2 w-2" />
                  {result.duration}
                </div>
              </div>

              {/* Title */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {result.title}
                </p>
              </div>

              {/* Add Button */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleAdd(result)}
                disabled={addingId === result.videoId}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-black transition-all hover:bg-[#1ed760] disabled:opacity-40"
              >
                {addingId === result.videoId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </motion.button>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
