"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { setLocale } from "@/actions/locale-actions";
import { motion } from "framer-motion";

export default function LanguageToggle() {
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      // Read current locale from cookie or default to en
      const current =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("locale="))
          ?.split("=")[1] || "en";

      const next = current === "en" ? "hi" : "en";
      await setLocale(next);
      window.location.reload();
    });
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleToggle}
      disabled={isPending}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-[#282828] px-3 py-2 text-xs font-medium text-zinc-300 shadow-lg ring-1 ring-white/5 transition-all hover:bg-[#333] hover:text-white disabled:opacity-50"
    >
      <Globe className="h-3.5 w-3.5" />
      {t("toggle")}
    </motion.button>
  );
}
