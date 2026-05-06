"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticated } from "@/lib/auth";

export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isAuthenticated() ? "/workspaces" : "/auth");
  }, [router]);
  return null;
}
