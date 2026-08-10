import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: {
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type MobileVoiceSearchButtonProps = {
  onTranscript: (text: string) => void;
  className?: string;
  /** Prefer Arabic recognition when UI is AR */
  preferArabic?: boolean;
};

/**
 * Mobile-optimized voice search using the Web Speech API.
 * - Single-utterance (not continuous) for medicine names
 * - EN / AR language from UI
 * - Graceful hide when unsupported (iOS Safari limitations noted)
 */
export function MobileVoiceSearchButton({
  onTranscript,
  className,
  preferArabic,
}: MobileVoiceSearchButtonProps) {
  const { t, language } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError(
        t(
          "Voice search is not supported in this browser",
          "البحث الصوتي غير مدعوم في هذا المتصفح",
        ),
      );
      return;
    }

    setError(null);
    const rec = new Ctor();
    recRef.current = rec;

    const useAr = preferArabic ?? language === "ar";
    // ar-EG for Egyptian Arabic; en-US for Latin trade names / INN
    rec.lang = useAr ? "ar-EG" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (ev) => {
      let finalText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row?.isFinal && row[0]?.transcript) {
          finalText += row[0].transcript;
        }
      }
      // Fallback: take last interim if no final yet
      if (!finalText && ev.results.length) {
        const last = ev.results[ev.results.length - 1];
        finalText = last?.[0]?.transcript || "";
      }
      const cleaned = finalText.trim().replace(/\s+/g, " ");
      if (cleaned) {
        onTranscript(cleaned);
        setListening(false);
      }
    };

    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed") {
        setError(
          t(
            "Microphone permission denied",
            "تم رفض إذن الميكروفون",
          ),
        );
      } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
        setError(
          t("Could not hear that — try again", "تعذر السمع — حاول مرة أخرى"),
        );
      }
    };

    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError(
        t("Could not start voice search", "تعذر بدء البحث الصوتي"),
      );
    }
  }, [language, onTranscript, preferArabic, t]);

  if (!supported) return null;

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant={listening ? "default" : "outline"}
        size="icon"
        className={cn(
          "h-10 w-10 shrink-0 rounded-xl",
          listening && "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse",
        )}
        aria-label={
          listening
            ? t("Stop listening", "إيقاف الاستماع")
            : t("Voice search", "بحث صوتي")
        }
        aria-pressed={listening}
        onClick={() => (listening ? stop() : start())}
      >
        {listening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : error ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-40 text-[10px] text-destructive text-right leading-tight">
          {error}
        </p>
      )}
      {listening && (
        <p className="absolute top-full right-0 mt-1 w-36 text-[10px] text-emerald-700 dark:text-emerald-400 text-right">
          {t("Listening… speak the medicine name", "جاري الاستماع… قل اسم الدواء")}
        </p>
      )}
    </div>
  );
}
