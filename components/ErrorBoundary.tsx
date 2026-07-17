"use client";
import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** اسم القسم — بيظهر في رسالة الخطأ */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — يمسك أي خطأ في الرندر بدل ما التطبيق كله يقع
 * برسالة "Application error" الفاضية، ويعرض نص الخطأ الحقيقي مع زرار
 * إعادة المحاولة. مهم جدًا للتشخيص في الإنتاج (ابعتوه للدعم لو اتكرر).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label || "page"}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4 bg-[#f8fafc] dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-6 text-center shadow-lg">
            <AlertTriangle className="mx-auto text-red-500" size={42} />
            <h1 className="font-bold text-lg mt-3">
              حصل خطأ غير متوقع في {this.props.label || "الصفحة"} 😅
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              لو المشكلة اتكررت، ابعت نص الخطأ ده للدعم الفني:
            </p>
            <p
              className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl p-3 mt-4 font-mono text-left break-all"
              dir="ltr"
            >
              {this.state.error?.name || "Error"}: {this.state.error?.message || "Unknown error"}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw size={15} /> حاول تاني
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-100 dark:bg-gray-700 font-bold py-2.5 rounded-xl text-sm"
              >
                تحديث الصفحة
              </button>
              <Link
                href="/"
                title="الرئيسية"
                className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center"
              >
                <Home size={18} />
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
