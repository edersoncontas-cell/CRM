"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AgendaAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
