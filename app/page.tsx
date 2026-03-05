"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Music2, Search as SearchIcon, ListMusic } from "lucide-react";
import { useTranslations } from "next-intl";
import OnboardingModal from "@/components/onboarding-modal";
import SearchBar from "@/components/search-bar";
import QueueList from "@/components/queue-list";
import LanguageToggle from "@/components/language-toggle";
import { generateClientId } from "@/lib/utils";

type UserData = {
  name: string;
  gender: string;
  clientId: string;
};

export default function Home() {
  const t = useTranslations("app");
  const tQueue = useTranslations("queue");
  const [user, setUser] = useState<UserData | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState<"search" | "queue">("queue");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("gymqueue_user");
    setTimeout(() => {
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setShowOnboarding(true);
        }
      } else {
        setShowOnboarding(true);
      }
      setMounted(true);
    }, 0);
  }, []);

  const handleOnboardingComplete = (data: UserData) => {
    localStorage.setItem("gymqueue_user", JSON.stringify(data));
    setUser(data);
    setShowOnboarding(false);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-[#1DB954] border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#121212]">
      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal
          clientId={user?.clientId || generateClientId()}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#121212]/95 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954]">
              <Music2 className="h-4 w-4 text-black" />
            </div>
            <h1 className="text-lg font-bold">{t("title")}</h1>
          </div>

          {user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#282828] text-xs font-bold text-[#1DB954]">
                {user.name[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-zinc-400">{user.name}</span>
            </motion.div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4">
        <div className="mx-auto max-w-lg">
          {user && (
            <>
              {tab === "search" ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <SearchBar clientId={user.clientId} userName={user.name} />
                </motion.div>
              ) : (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <QueueList clientId={user.clientId} />
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg">
          {[
            { id: "queue" as const, icon: ListMusic, label: tQueue("title") },
            { id: "search" as const, icon: SearchIcon, label: "Search" },
          ].map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                tab === item.id
                  ? "text-[#1DB954]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {tab === item.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 h-0.5 w-12 rounded-full bg-[#1DB954]"
                />
              )}
            </motion.button>
          ))}
        </div>
      </nav>

      {/* Language Toggle */}
      <LanguageToggle />
    </div>
  );
}
