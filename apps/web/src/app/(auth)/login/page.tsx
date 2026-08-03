"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Invalid access token. Check your credentials and try again.");
      return;
    }

    const next = searchParams.get("next") ?? "/";
    router.replace(next);
  }

  return (
    <div className="card w-full max-w-md shadow-lg">
      <div className="mb-8 text-center">
        <p className="label-caps mb-2">Oracle</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Rock Island Property Intelligence
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your access token to explore county parcel data.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="access-token" className="label-caps block">
            Access token
          </label>
          <input
            id="access-token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="input-base"
            placeholder="••••••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="card w-full max-w-md space-y-4 shadow-lg">
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-4 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
