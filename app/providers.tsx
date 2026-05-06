"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      {children}
      {!CLIENT_ID && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-50 max-w-sm rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-caption text-warning"
        >
          NEXT_PUBLIC_GOOGLE_CLIENT_ID 가 설정되지 않았습니다. .env.local 을 확인하세요.
        </div>
      )}
    </GoogleOAuthProvider>
  );
}
