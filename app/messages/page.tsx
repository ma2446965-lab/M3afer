"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db } from "@/lib/firebase";
import {
  MAX_MESSAGE_LEN,
  PLATFORM_NAME,
  SUPPORT_LABEL,
  canStartConversation,
  dmConvId,
  normalizeUuid,
  peerLabel,
  peerUidOf,
  previewText,
  sortConversations,
  supportConvId,
  validateMessageText,
  type ConversationDoc
} from "@/lib/messages";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import {
  MessagesSquare,
  Send,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
  UserPlus,
  PartyPopper
} from "lucide-react";

const CONVS = "conversations";

type FoundPeer = { uid: string; label: string; isSubscriber: boolean; isAdmin: boolean };

function timeOf(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function MessagesPageInner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const isAdmin = profile?.role === "admin";
  const isSubscriber = profile?.subscribed === true;
  const canCompose = isAdmin || isSubscriber;

  const [convs, setConvs] = useState<(ConversationDoc & { id: string })[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  // composer modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [uuidInput, setUuidInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<FoundPeer | null>(null);
  const [lookupErr, setLookupErr] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const supportHandled = useRef<string>("");

  // ── auth gate (browsing messages needs an account) ──
  useEffect(() => {
    if (!loading && !user) router.replace(`/auth/login?next=${encodeURIComponent("/messages")}`);
  }, [loading, user, router]);

  // ── my conversations (array-contains only → sort client-side, no index) ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, CONVS), where("members", "array-contains", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setConvs(sortConversations(list));
      },
      () => setToast("تعذر تحميل المحادثات — تأكد إن قواعد Firestore الجديدة اتنشرت")
    );
    return () => unsub();
  }, [user]);

  const activeConv = useMemo(() => convs.find((c) => c.id === selectedId) || null, [convs, selectedId]);

  // ── messages of the open thread ──
  useEffect(() => {
    if (!user || !selectedId) return;
    const q = query(collection(db, CONVS, selectedId, "messages"), orderBy("createdAt", "asc"), limit(150));
    const unsub = onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      () => setToast("تعذر فتح المحادثة")
    );
    return () => unsub();
  }, [user, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  // ── deep link: /messages?support=<studentUid> (from the admin panel) ──
  useEffect(() => {
    const target = params.get("support");
    if (!target || !isAdmin || !user || supportHandled.current === target) return;
    supportHandled.current = target;
    (async () => {
      try {
        const cid = supportConvId(target);
        const ref = doc(db, CONVS, cid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const uSnap = await getDoc(doc(db, "users", target));
          const u = uSnap.data() as any;
          const now = new Date().toISOString();
          const conv: ConversationDoc = {
            members: [user.uid, target],
            type: "support",
            memberLabels: {
              [user.uid]: SUPPORT_LABEL,
              [target]: peerLabel({ role: u?.role, grade: u?.grade, track: u?.track, uuid: u?.uuid })
            },
            lastMessageText: "",
            lastMessageAt: now,
            createdAt: now
          };
          await setDoc(ref, conv);
        }
        setSelectedId(cid);
      } catch {
        setToast("تعذر فتح محادثة الدعم مع الطالب ده");
      }
    })();
  }, [params, isAdmin, user]);

  // ── uuid discovery: admins query Firestore directly (rules allow), students
  //    go through the narrow /api/users/lookup window. ──
  const lookup = async () => {
    if (!user) return;
    const uuid = normalizeUuid(uuidInput);
    if (uuid.length < 8) {
      setLookupErr("اكتب الـ UUID كامل من بروفايل صاحبك");
      return;
    }
    setLooking(true);
    setLookupErr("");
    setFound(null);
    try {
      if (isAdmin) {
        const snap = await getDocs(query(collection(db, "users"), where("uuid", "==", uuid), limit(1)));
        if (snap.empty) throw new Error("مفيش طالب بالـ UUID ده");
        const d0 = snap.docs[0];
        const d = d0.data() as any;
        if (d0.id === user.uid) throw new Error("ده الـ UUID بتاعك 😄");
        setFound({
          uid: d0.id,
          label: peerLabel({ role: d.role, grade: d.grade, track: d.track, uuid: d.uuid }),
          isSubscriber: d.subscribed === true,
          isAdmin: d.role === "admin"
        });
      } else {
        const token = await user.getIdToken();
        const res = await fetch(`/api/users/lookup?uuid=${encodeURIComponent(uuid)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "تعذر البحث — جرب تاني");
        setFound(data as FoundPeer);
      }
    } catch (e: any) {
      setLookupErr(e?.message || "تعذر البحث — جرب تاني");
    } finally {
      setLooking(false);
    }
  };

  // ── start (or resume) the conversation with the found peer ──
  const startConversation = async () => {
    if (!user || !profile || !found) return;
    const check = canStartConversation({
      type: isAdmin ? "support" : "dm",
      isAdmin,
      isSubscriber,
      peerIsAdmin: found.isAdmin,
      peerIsSubscriber: found.isSubscriber
    });
    if (!check.ok) {
      setLookupErr(check.reason);
      return;
    }
    try {
      const cid = isAdmin ? supportConvId(found.uid) : dmConvId(user.uid, found.uid);
      const ref = doc(db, CONVS, cid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const now = new Date().toISOString();
        const myLabel = isAdmin
          ? SUPPORT_LABEL
          : peerLabel({ role: profile.role, grade: profile.grade, track: profile.track, uuid: profile.uuid });
        const conv: ConversationDoc = {
          members: [user.uid, found.uid],
          type: isAdmin ? "support" : "dm",
          memberLabels: { [user.uid]: myLabel, [found.uid]: found.label },
          lastMessageText: "",
          lastMessageAt: now,
          createdAt: now
        };
        await setDoc(ref, conv);
      }
      setSelectedId(cid);
      setComposerOpen(false);
      setUuidInput("");
      setFound(null);
      setLookupErr("");
    } catch (e: any) {
      setLookupErr(
        e?.code === "permission-denied"
          ? "القواعد رفضت إنشاء المحادثة — المراسلة بين الطلاب للمشتركين بس"
          : "حصل خطأ — جرب تاني"
      );
    }
  };

  const send = async () => {
    if (!user || !activeConv || sending) return;
    const v = validateMessageText(text);
    if (!v.ok) {
      setToast(v.reason);
      return;
    }
    setSending(true);
    try {
      const body = text.trim();
      const now = new Date().toISOString();
      // Admin messages inside support rooms carry the platform identity.
      const fromPlatform = isAdmin && activeConv.type === "support";
      await addDoc(collection(db, CONVS, activeConv.id, "messages"), {
        senderId: user.uid,
        text: body,
        fromPlatform,
        createdAt: now
      });
      await updateDoc(doc(db, CONVS, activeConv.id), {
        lastMessageText: body,
        lastMessageAt: now
      }).catch(() => {});
      setText("");
    } catch (e: any) {
      setToast(
        e?.code === "permission-denied"
          ? "الإرسال اترفض — المراسلة بين الطلاب للمشتركين بس ✨"
          : "تعذر الإرسال — جرب تاني"
      );
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-fuchsia-500" size={32} />
      </div>
    );
  }

  const peerLabelOf = (c: ConversationDoc) => {
    const peer = peerUidOf(c, user.uid);
    return c.memberLabels?.[peer] || (c.type === "support" ? SUPPORT_LABEL : "طالب");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">
      {/* toast */}
      {toast && (
        <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[90] bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          {toast}
          <button onClick={() => setToast("")} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="lg:h-screen flex flex-col">
        {/* header */}
        <div className="bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 text-white p-5 md:p-6 md:py-5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-60 h-60 bg-white/10 rounded-full blur-3xl -translate-y-16 translate-x-16" />
          <div className="relative max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <MessagesSquare size={22} /> الرسائل
              </h1>
              <p className="text-white/85 text-xs md:text-sm mt-1">
                {isAdmin ? "صندوق دعم الطلاب — افتح محادثة بأي UUID 🛡️" : "كلم صحابك المشتركين بـ UUID، ودعم مِعافر دايمًا هنا 💬"}
              </p>
            </div>
            {canCompose ? (
              <button
                onClick={() => setComposerOpen(true)}
                className="bg-white text-fuchsia-700 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition shrink-0"
              >
                <Plus size={16} /> محادثة جديدة
              </button>
            ) : (
              <Link
                href="/subscription"
                className="bg-white/15 border border-white/30 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 hover:bg-white/25 transition shrink-0"
              >
                <Sparkles size={14} /> المراسلة للمشتركين
              </Link>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto lg:grid lg:grid-cols-[20rem,1fr] lg:p-4 lg:gap-4 p-3">
          {/* conversation list */}
          <aside className={`bg-white dark:bg-gray-800 lg:rounded-2xl rounded-xl border dark:border-gray-700 lg:h-full lg:flex lg:flex-col overflow-hidden ${selectedId ? "hidden lg:flex" : "flex flex-col"} h-[calc(100vh-12rem)] lg:h-auto`}>
            <div className="p-3 border-b dark:border-gray-700 text-xs text-gray-400 font-bold shrink-0">
              محادثاتك ({convs.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
              {convs.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <PartyPopper size={32} className="mx-auto text-fuchsia-300" />
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {canCompose
                      ? "لسه مفيش محادثات — دوس «محادثة جديدة» وحط UUID صاحبك (بيلاقيه في صفحة «حسابي») 🎯"
                      : "المراسلة بين الطلاب للمشتركين ✨ — بس لو دعم مِعافر كلمك، هتلاقي المحادثة هنا وتقدر ترد عادي"}
                  </p>
                </div>
              ) : (
                convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-right p-3.5 hover:bg-fuchsia-50/60 dark:hover:bg-gray-700/40 transition flex items-start gap-3 ${selectedId === c.id ? "bg-fuchsia-50 dark:bg-fuchsia-900/20" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 text-sm font-black ${c.type === "support" ? "bg-gradient-to-br from-sky-500 to-indigo-600" : "bg-gradient-to-br from-fuchsia-500 to-purple-600"}`}>
                      {c.type === "support" ? "🤖" : "💬"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{peerLabelOf(c)}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{timeOf(c.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.type === "support" && (
                          <span className="text-[9px] bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <ShieldCheck size={9} /> دعم رسمي
                          </span>
                        )}
                        <p className="text-xs text-gray-400 truncate">{c.lastMessageText ? previewText(c.lastMessageText, 45) : "محادثة جديدة — قول سلام 👋"}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* thread */}
          <section className={`bg-white dark:bg-gray-800 lg:rounded-2xl rounded-xl border dark:border-gray-700 lg:h-full flex-col overflow-hidden ${selectedId ? "flex h-[calc(100vh-12rem)] lg:h-auto" : "hidden lg:flex"}`}>
            {!activeConv ? (
              <div className="flex-1 hidden lg:flex items-center justify-center text-gray-300 dark:text-gray-600 flex-col gap-3">
                <MessagesSquare size={48} />
                <p className="text-sm font-medium">اختار محادثة من القايمة</p>
              </div>
            ) : (
              <>
                {/* thread header */}
                <div className="p-3.5 border-b dark:border-gray-700 flex items-center gap-3 shrink-0 bg-gray-50/60 dark:bg-gray-800">
                  <button onClick={() => setSelectedId("")} className="lg:hidden p-2 -m-1 text-gray-400">
                    <ArrowRight size={20} />
                  </button>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm ${activeConv.type === "support" ? "bg-gradient-to-br from-sky-500 to-indigo-600" : "bg-gradient-to-br from-fuchsia-500 to-purple-600"}`}>
                    {activeConv.type === "support" ? "🤖" : "💬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{peerLabelOf(activeConv)}</p>
                    <p className="text-[10px] text-gray-400">
                      {activeConv.type === "support" ? "قناة دعم رسمية مع مِعافر 🛡️" : "محادثة بين مشتركين ✨"}
                    </p>
                  </div>
                </div>

                {/* messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50/50 dark:bg-gray-900/30">
                  {messages.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-10">ابدأ السلام — الرسايل بتتحفظ ولا بتتمسح 👋</p>
                  )}
                  {messages.map((m) => {
                    const mine = m.senderId === user.uid;
                    if (m.fromPlatform) {
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className="max-w-[80%] rounded-2xl p-[1.5px] bg-gradient-to-r from-sky-500 to-indigo-600 shadow-sm">
                            <div className="rounded-2xl bg-white dark:bg-gray-800 p-3">
                              <p className="text-[10px] font-black bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent flex items-center gap-1 mb-1">
                                {PLATFORM_NAME} <ShieldCheck size={10} className="text-sky-500" />
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                              <p className="text-[9px] text-gray-400 mt-1">{timeOf(m.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${mine ? "bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white rounded-br-md" : "bg-white dark:bg-gray-700 rounded-bl-md border dark:border-gray-600"}`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          <p className={`text-[9px] mt-1 ${mine ? "text-white/70" : "text-gray-400"}`}>{timeOf(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* composer */}
                <div className="p-3 border-t dark:border-gray-700 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      placeholder="اكتب رسالتك..."
                      className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3 text-sm outline-none resize-none max-h-32 placeholder:text-gray-400"
                    />
                    <button
                      onClick={send}
                      disabled={sending || !text.trim()}
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/25 hover:scale-105 transition disabled:opacity-40 shrink-0"
                    >
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="-scale-x-100" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between">
                    <span>Enter للإرسال • Shift+Enter سطر جديد</span>
                    <span className={text.length > MAX_MESSAGE_LEN ? "text-red-500 font-bold" : ""}>{text.length}/{MAX_MESSAGE_LEN}</span>
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ═══ composer modal (uuid discovery) ═══ */}
      {composerOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setComposerOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-[28px] sm:rounded-[24px] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus size={18} className="text-fuchsia-500" />
                {isAdmin ? "فتح محادثة دعم مع طالب 🛡️" : "ابدأ محادثة جديدة 💬"}
              </h3>
              <button onClick={() => setComposerOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1">✕</button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {isAdmin
                ? "حط UUID الطالب (من جدول الطلاب أو من صفحة «حسابي» بتاعته) — ولو فيه محادثة دعم قديمة معاه هتتفتح على طول."
                : "حط UUID صاحبك — بيلاقيه مكتوب في صفحة «حسابي» عنده. مفيش دليل عام للطلاب: لازم يكون هو بعتهولك 🔒"}
            </p>
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={uuidInput}
                onChange={(e) => { setUuidInput(e.target.value); setFound(null); setLookupErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                dir="ltr"
                className="w-full p-3 pr-9 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none focus:border-fuchsia-400 font-mono"
              />
            </div>
            {lookupErr && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{lookupErr}</p>}
            {!found ? (
              <button
                onClick={lookup}
                disabled={looking || uuidInput.trim().length < 8}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {looking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                ابحث بالـ UUID
              </button>
            ) : (
              <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center font-black">💬</div>
                  <div>
                    <p className="font-bold text-sm">{found.label}</p>
                    <p className="text-[11px] text-gray-500">
                      {found.isAdmin ? "حساب إدارة 🛡️" : found.isSubscriber ? "مشترك ✨" : "مش مشترك"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={startConversation}
                  className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <MessagesSquare size={16} />
                  {isAdmin ? "افتح محادثة الدعم" : "ابدأ المحادثة"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
          <Loader2 className="animate-spin text-fuchsia-500" size={32} />
        </div>
      }>
        <MessagesPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}
