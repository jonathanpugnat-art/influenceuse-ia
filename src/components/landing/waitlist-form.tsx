"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  /**
   * Tagging for analytics — passed back to the API so admins can see
   * which CTA position converted (hero vs final-cta vs pricing-bottom).
   */
  source?: string;
  variant?: "hero" | "inline";
}

/**
 * Closed-beta waitlist form used on the landing page.
 *
 * Three end-states:
 *   - **idle**      : email input + CTA button
 *   - **submitting** : button disabled + spinner
 *   - **success**   : green confirmation card. Shows a slightly different
 *                     copy when the user was already on the list, so the
 *                     UX never feels like a duplicate-submit error.
 *
 * The form is intentionally minimal (email + optional name) — every extra
 * field cuts conversion by ~10% on landings. We capture more details on
 * the post-invite onboarding instead.
 */
export function WaitlistForm({ source = "landing", variant = "hero" }: Props) {
  const t = useTranslations("waitlist");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // Honeypot: real users never see this field; bots auto-fill it.
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [errorKey, setErrorKey] = useState<string>("");
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorKey("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          source,
          companyWebsite,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        alreadyOnList?: boolean;
      };

      if (!res.ok || !data.ok) {
        setErrorKey(data.error ?? "internal");
        setStatus("error");
        return;
      }

      setAlreadyOnList(Boolean(data.alreadyOnList));
      setStatus("success");
    } catch {
      setErrorKey("network");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200"
      >
        <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
        <div className="text-sm">
          <p className="font-semibold text-emerald-100">
            {alreadyOnList ? t("successDup") : t("success")}
          </p>
          <p className="text-emerald-200/80 text-xs mt-0.5">
            {t("successSub")}
          </p>
        </div>
      </motion.div>
    );
  }

  const baseInput =
    "h-12 px-4 rounded-xl bg-zinc-900/70 border border-zinc-700/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === "hero"
          ? "mx-auto w-full max-w-md flex flex-col sm:flex-row gap-2"
          : "w-full flex flex-col sm:flex-row gap-2"
      }
    >
      {/* Honeypot — visually hidden but discoverable by naive bots. */}
      <input
        type="text"
        name="company_website"
        value={companyWebsite}
        onChange={(e) => setCompanyWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className={`${baseInput} flex-1`}
        disabled={status === "submitting"}
        aria-label={t("emailPlaceholder")}
      />

      <button
        type="submit"
        disabled={status === "submitting" || !email}
        className="h-12 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-violet-900/30"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("submitting")}
          </>
        ) : (
          t("cta")
        )}
      </button>

      <AnimatePresence>
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sm:hidden flex items-center gap-2 text-rose-300 text-xs px-1"
          >
            <AlertCircle className="size-3.5" />
            {errorKey === "rate_limited"
              ? t("errorRateLimit")
              : errorKey === "disposable_email_blocked"
                ? t("errorDisposable")
                : t("errorGeneric")}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
