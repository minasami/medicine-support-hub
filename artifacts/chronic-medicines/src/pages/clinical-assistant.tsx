import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { useGetClinicalSupport } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;
  sources?: string[];
}

export default function ClinicalAssistant() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t(
        "Hello. I am the Clinical Support Assistant. How can I help you review medicine interactions or guidelines today?",
        "مرحباً. أنا المساعد السريري. كيف يمكنني مساعدتك في مراجعة التفاعلات الدوائية أو الإرشادات اليوم؟"
      )
    }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const getClinicalSupport = useGetClinicalSupport();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || getClinicalSupport.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery("");

    // Context from previous messages
    const context = messages
      .slice(-4)
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    getClinicalSupport.mutate(
      { data: { query: userMessage.content, context } },
      {
        onSuccess: (data) => {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: data.response,
              disclaimer: data.disclaimer,
              sources: data.sources
            }
          ]);
        },
        onError: () => {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: t(
                "I'm sorry, I encountered an error processing your request. Please try again.",
                "عذراً، واجهت خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى."
              )
            }
          ]);
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl h-[calc(100vh-5rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          {t("Clinical Support Assistant", "مساعد الدعم السريري")}
        </h1>
      </div>

      <Alert variant="destructive" className="mb-6 bg-amber-500/10 text-amber-900 border-amber-500/50 [&>svg]:text-amber-600 rounded-lg">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-bold text-amber-900">
          FOR DECISION SUPPORT ONLY / للدعم في اتخاذ القرار فقط
        </AlertTitle>
        <AlertDescription className="text-amber-800 font-medium">
          NOT A FINAL CLINICAL DECISION. Verify all information with official medical references before approving requests.
          <br/>
          ليس قراراً سريرياً نهائياً. تحقق من جميع المعلومات من المراجع الطبية الرسمية قبل الموافقة على الطلبات.
        </AlertDescription>
      </Alert>

      <Card className="flex-1 flex flex-col overflow-hidden border-primary/10 shadow-lg shadow-primary/5">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 pb-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "ml-auto rtl:mr-auto rtl:ml-0 flex-row-reverse" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`space-y-2 ${msg.role === "user" ? "text-right rtl:text-left" : ""}`}>
                  <div className={`p-4 rounded-2xl ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm rtl:rounded-tr-2xl rtl:rounded-tl-sm" 
                      : "bg-muted/50 border rounded-tl-sm rtl:rounded-tl-2xl rtl:rounded-tr-sm"
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      <span className="font-medium">{t("Sources:", "المصادر:")}</span>
                      {msg.sources.map((source, i) => (
                        <span key={i} className="bg-muted px-2 py-0.5 rounded-full">{source}</span>
                      ))}
                    </div>
                  )}
                  
                  {msg.disclaimer && (
                    <div className="text-[10px] text-amber-600/80 bg-amber-500/5 p-2 rounded border border-amber-500/10 mt-2">
                      {msg.disclaimer}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {getClinicalSupport.isPending && (
              <div className="flex gap-4 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted/50 border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t("Analyzing...", "جاري التحليل...")}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <CardFooter className="p-4 border-t bg-muted/10">
          <form onSubmit={handleSubmit} className="w-full flex gap-2">
            <Textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Type your clinical query here...", "اكتب استفسارك السريري هنا...")}
              className="resize-none min-h-[60px] max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              data-testid="input-chat"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-auto shrink-0 w-14" 
              disabled={!query.trim() || getClinicalSupport.isPending}
              data-testid="button-send-chat"
            >
              {getClinicalSupport.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 rtl:-scale-x-100" />
              )}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
