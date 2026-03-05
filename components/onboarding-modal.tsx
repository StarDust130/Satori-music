"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { registerUser } from "@/actions/user-actions";

type Props = {
  onComplete: (data: {
    name: string;
    gender: string;
    clientId: string;
  }) => void;
  clientId: string;
};

export default function OnboardingModal({ onComplete, clientId }: Props) {
  const t = useTranslations("onboarding");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "loading">("form");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setStep("loading");
    setLoading(true);

    try {
      const result = await registerUser({
        name: name.trim(),
        gender: gender || undefined,
        clientId,
      });

      onComplete({
        name: name.trim(),
        gender: result.gender,
        clientId,
      });
    } catch {
      setStep("form");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="w-full max-w-sm rounded-2xl bg-[#181818] p-6 shadow-2xl border border-white/5"
          >
            {/* Header */}
            <div className="mb-6 text-center">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 10 }}
                transition={{
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: 1.5,
                }}
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DB954]/20"
              >
                <Sparkles className="h-7 w-7 text-[#1DB954]" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white">{t("welcome")}</h2>
              <p className="mt-1 text-sm text-zinc-400">{t("subtitle")}</p>
            </div>

            {/* Name Input */}
            <div className="mb-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  maxLength={20}
                  className="w-full rounded-xl bg-[#282828] py-3 pl-10 pr-4 text-white placeholder-zinc-500 outline-none ring-1 ring-white/5 transition-all focus:ring-[#1DB954]/50"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoFocus
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div className="mb-6">
              <label className="mb-2 block text-xs text-zinc-400">
                {t("genderLabel")}
              </label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(gender === g ? "" : g)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                      gender === g
                        ? "bg-[#1DB954] text-black"
                        : "bg-[#282828] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t(g)}
                  </button>
                ))}
              </div>
              {!gender && (
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  Leave blank and AI will guess ✨
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="w-full rounded-full bg-[#1DB954] py-3 text-sm font-bold text-black transition-all hover:bg-[#1ed760] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("continue")} 🎵
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#1DB954] border-t-transparent"
            />
            <p className="text-zinc-400">
              {loading ? "Setting up your profile..." : ""}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
