# Meafer.ai - منصة الثانوية العامة الذكية 🧠

AI-powered e-learning platform for Egyptian Thanaweya Amma students (الصف الأول/الثاني/الثالث الثانوي - علمي علوم / علمي رياضة / أدبي)

Built with Next.js 14 (App Router), Firebase (Auth, Firestore, Storage), Gemini API.

## ✨ Features Implemented

### 1. UI/UX & Layout
- ✅ Mobile-first responsive (looks like native app)
- ✅ Bottom Navigation Bar: Home, Library, Quizzes, Profile
- ✅ Hamburger Menu Drawer: Settings, Language (AR/EN), Dark/Light toggle, Subscription, Support
- ✅ Floating AI Chat (Draggable FAB) with close X, reopen from hamburger menu, bottom-sheet chat

### 2. Onboarding (Blocking)
- ✅ After signup, mandatory Grade & Track selection
  - Grade: الصف الأول/الثاني/الثالث الثانوي
  - Track: skip for Grade 1 (unified), else علمي علوم / علمي رياضة / أدبي
- ✅ Stored in Firestore user profile
- ✅ Used to filter PDFs and condition Gemini prompts

### 3. AI Assistants Personas
- ✅ **ing.Mohamed**: witty engineer, tech analogies, logic puzzles
- ✅ **Dr.Basmala**: sweet doctor, medical analogies, encouraging
- ✅ Both aware of Thanaweya Amma pressure, Egyptian Arabic default
- ✅ System prompt injection with grade/track + Egyptian Ministry style (مسائل تراكمية، سؤال البيانات، درجة التفكير الناقد)

### 4. Core Features
- ✅ Subject Tagging: config object per grade/track (easy yearly update) at `lib/subjects.ts`
- ✅ PDF RAG: Upload to Firebase Storage (scoped via security rules), parse text, Gemini generates:
  - Summaries (adjustable length) - مراجعة نهائية style
  - Quizzes - Ministry exam format (bubble sheet, etc.)
  - Flashcards
  - Audio Script Placeholder (NotebookLM style + TTS TODO)
- ✅ Gamification: Daily Streaks tied to per-subject schedule
- ✅ Global UUID per user displayed in Profile
- ✅ Security Rules files included

### 5. Auth & Admin
- ✅ Email/Password Firebase Auth
- ✅ Role-based admin: `role` field in Firestore, default "user", manually set to "admin" in console
- ✅ `/admin` protected route, checks role from Firestore
- ✅ Admin can search by UUID and upgrade subscription tier

### 6. Subscription & Payments (Fatorak / Fawaterak)
- ✅ Single plan: **150 EGP / 30 days** — subscribe button redirects to Fawaterak hosted payment page
- ✅ Auth to Fatorak: **OAuth 2.0 client_credentials** — `POST {base}/oauth/token` (`FATORAK_MERCHANT_ID` = client_id, `FATORAK_SECRET_KEY` = client_secret) → short-lived access token, **cached & auto-refreshed** (60s early + retry-on-401) in `lib/server/fatorak.ts`
- ✅ `/api/fatorak/checkout` (server-only): verifies Firebase ID token, then `POST {base}/api/v2/createInvoiceLink` with `Authorization: Bearer <oauth access token>`
- ✅ `/api/fatorak-webhook`: verifies `hashKey` = HMAC-SHA256 of `InvoiceId=..&InvoiceKey=..&PaymentMethod=..` with the vendor secret (per the published "Web Hook" docs page — re-verified; secret = `FATORAK_WEBHOOK_SECRET` if set, else `FATORAK_SECRET_KEY`), then sets `users/{uid}: { subscribed: true, subscriptionStartDate, subscriptionEndDate: +30d }` — idempotent (webhook retries don't double-extend; active renewals stack). Non-paid/expiry callbacks are ack-ignored safely
- ✅ Vercel Cron `/api/cron/expire-subscriptions` (daily 3 AM, `CRON_SECRET` protected): sets `subscribed: false` for expired users
- ✅ Payment fields are locked by Firestore rules — clients can NEVER self-set `subscribed` (Admin SDK only)
- ❌ WhatsApp payment concierge removed entirely

### 7. Env & Credentials
- ✅ Keys in `.env.local` never hardcoded

### 8. Admin CRUD Panel (/admin)
- ✅ Tabbed UI, protected by `role == "admin"` check (redirects everyone else to home)
- ✅ **Subjects** manager — Firestore `subjects: { name, description, teacherName, price, imageUrl }` — add / edit / delete in a table UI with live updates
- ✅ **Lesson slots** manager — Firestore `slots: { subjectId, date, time, capacity, bookedCount }` — with remaining-seats indicator and per-subject filter
- ✅ **Students** list (read-only) — every user with plan, effective subscribed status (نشط / منتهي حسب `subscriptionEndDate`), join date, plus UUID search & subscription upgrade tool
- ✅ `firestore.rules`: `subjects` & `slots` readable by any signed-in user, **writable by admin only**, with field validation

### 9. Student Booking (/booking + /schedule)
- ✅ Gated behind `subscribed: true` — unsubscribed students get a locked preview + "Subscribe to unlock" prompt
- ✅ `/booking`: pick a subject → see available `slots` (only future & `bookedCount < capacity`) → one-tap booking
- ✅ Booking = Firestore **transaction**: creates `bookings/{slotId}_{studentId}` (`studentId, slotId, subjectId, date, time, status: 'confirmed', createdAt`) + increments `bookedCount` atomically
- ✅ Deterministic booking ID makes double-booking the same slot impossible
- ✅ `/schedule`: "My Schedule" — my bookings sorted by date (upcoming vs past), with cancel (transaction decrement)
- ✅ Rules enforce both sides of the transaction via `get`/`getAfter`: no count change without the matching booking write
- ✅ Nav entry points: bottom bar, hamburger menu, desktop sidebar, home CTA card

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

First signup, then check Firebase Console > Firestore > users/{uid} > change role to "admin" for your account to access /admin

## 📁 Project Structure
- `app/` - Next.js App Router pages (Home, Library, Quizzes, Profile, Subscription, Admin, Auth)
- `components/` - BottomNav, HamburgerMenu, FloatingChat, OnboardingFlow
- `lib/` - firebase.ts, subjects.ts (config), gemini.ts (AI prompts)
- `context/` - AuthContext, ThemeContext

## 🔐 Security Rules
See `firestore.rules` and `storage.rules` - every user can only read/write their own docs/files matched against Firebase Auth UID. Admin override included.

## 🧪 Gemini Integration
Gemini API key from .env.local used in `lib/gemini.ts`. Includes fallback mock if quota fails. System prompts always include grade/track context.

## 📱 Mobile-First
Bottom nav hidden on md+ (desktop has sidebar), hamburger top-right, FAB draggable with touch support, bottom-sheet chat.

## 🌐 Language
Arabic (Egyptian) default, English switcher in hamburger, dir attribute toggled.

---
Made with ❤️ for Thanaweya Amma students
