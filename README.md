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

### 6. Subscription & WhatsApp
- ✅ Pricing Tiers with strike-through discounts: Basic 99EGP (200), Pro 299 (600), Premium 499 (1000)
- ✅ WhatsApp Concierge Flow: `https://wa.me/201128182537?text=Hello,%20I%20am%20user%20[UUID]%20and%20I%20want%20to%20subscribe%20to%20the%20[PLAN]%20plan.`

### 7. Env & Credentials
- ✅ Keys in `.env.local` never hardcoded

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
