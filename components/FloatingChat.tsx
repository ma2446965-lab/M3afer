"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, Bot, User as UserIcon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { generateWithGemini, AIPersona } from "@/lib/gemini";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function FloatingChat() {
  const { isFabVisible, setFabVisible, language } = useTheme();
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [persona, setPersona] = useState<AIPersona>("ing.Mohamed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  // On md+ the persistent SideNav occupies the inline-start edge (256px) —
  // shift the FAB so it never sits on top of it.
  const [isDesktop, setIsDesktop] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (profile?.preferredPersona) {
      setPersona(profile.preferredPersona);
    }
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!profile) return;
    if (messages.length === 0) {
      const welcome = persona === "ing.Mohamed"
        ? `أهلا يا بشمهندس! ${profile.email.split('@')[0]} 👋\nأنا بشمهندس محمد، صاحبك في رحلة الثانوية العامة.\n${profile.grade} - ${profile.track || 'عام'}\n\nجاهز نحل أي مسألة تراكمية أو نـ debug أي معلومة واقفة معاك؟ ابعتلي اللي واقف معاك! 🚀`
        : `أهلاً يا دكتور/دكتورة المستقبل! 🌸\nأنا دكتورة بسملة، وموجودة هنا عشان أساعدك خطوة بخطوة.\nعرفت إنك في ${profile.grade} - ${profile.track || 'عام'}، وضغط الثانوية العامة طبيعي جداً، بس إحنا هنعديه سوا 💙\n\nقولي إيه المادة اللي حاسس إنها تقيلة عليك النهاردة؟`;
      
      setMessages([{ id: "welcome", role: "assistant", content: welcome, timestamp: new Date() }]);
    }
  }, [isOpen, persona]);

  const handleSend = async () => {
    if (!input.trim() || !profile) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await generateWithGemini(
        input,
        persona,
        profile.grade || "الصف الثالث الثانوي",
        profile.track || "علمي علوم"
      );
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "ياااه النت بيهنج شوية 😅 جرب تاني كمان ثواني!",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Draggable logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - startX,
        y: e.clientY - startY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!isFabVisible) return null;

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <div
          ref={fabRef}
          className="fixed z-50 select-none"
          style={{ right: `${position.x + (isDesktop ? 264 : 0)}px`, bottom: `${position.y}px`, cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
        >
          <div className="relative">
            <button
              onClick={() => !isDragging && setIsOpen(true)}
              className="w-14 h-14 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-full shadow-[0_8px_24px_rgba(14,165,233,0.4)] flex items-center justify-center text-white hover:scale-110 transition-transform animate-float"
            >
              <MessageCircle size={26} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFabVisible(false); }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 transition"
            >
              <X size={12} />
            </button>
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white" />
          </div>
        </div>
      )}

      {/* Chat Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-end md:items-end md:p-6">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div ref={chatRef} className="relative w-full md:w-[420px] h-[85vh] md:h-[600px] bg-white dark:bg-gray-900 rounded-t-[32px] md:rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="bg-gradient-to-br from-sky-500 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">{persona === "ing.Mohamed" ? "بشمهندس محمد" : "دكتورة بسملة"}</h3>
                    <p className="text-xs text-white/80 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse inline-block"></span>
                      متصل الآن • مساعد ثانوية عامة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsOpen(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Persona Switcher */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPersona("ing.Mohamed")}
                  className={`p-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${persona === "ing.Mohamed" ? "bg-white text-indigo-600 shadow" : "bg-white/15 text-white hover:bg-white/25"}`}
                >
                  👨‍💻 ing.Mohamed
                </button>
                <button
                  onClick={() => setPersona("Dr.Basmala")}
                  className={`p-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${persona === "Dr.Basmala" ? "bg-white text-indigo-600 shadow" : "bg-white/15 text-white hover:bg-white/25"}`}
                >
                  👩‍⚕️ Dr.Basmala
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-700 shadow border"}`}>
                    {msg.role === "user" ? <UserIcon size={16} /> : persona === "ing.Mohamed" ? "👨‍💻" : "👩‍⚕️"}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white dark:bg-gray-800 rounded-bl-sm border dark:border-gray-700"}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <span className={`text-[10px] mt-1 block ${msg.role === "user" ? "text-white/70" : "text-gray-400"}`}>
                      {msg.timestamp.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow border flex items-center justify-center">
                    {persona === "ing.Mohamed" ? "👨‍💻" : "👩‍⚕️"}
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm p-3 border dark:border-gray-700 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={language === "ar" ? "اسأل أي حاجة في المنهج..." : "Ask anything..."}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-full flex items-center justify-center hover:scale-105 transition disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
                <Sparkles size={10} /> مدعوم بـ Gemini AI • مخصص لمنهج {profile?.grade} {profile?.track}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
