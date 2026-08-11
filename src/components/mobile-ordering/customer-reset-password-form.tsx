"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";

export function CustomerResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    void (async () => {
      try {
        const res = await fetch("/api/auth/exchange-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          setError(
            data.message || "Invalid or expired reset link. Please request a new password reset.",
          );
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {
        setError("Failed to validate reset link. Please request a new password reset.");
      }
    })();
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPasswordError(null);

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const code = searchParams.get("code");
      if (code) {
        const codeRes = await fetch("/api/auth/exchange-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });
        if (!codeRes.ok) {
          const codeData = (await codeRes.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(
            codeData.message || "Invalid or expired reset link. Please request a new password reset.",
          );
        }
      }

      const result = await resetPassword({ password });
      if (result.error) {
        throw new Error(result.error);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-2xl">
        <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
          <div className="space-y-8">
            <div className="flex justify-center">
              <div className="w-28 h-28 relative">
                <Image
                  src="/BSVG.svg"
                  alt="BerryTap Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                Password reset successful
              </h1>
              <p className="text-muted-foreground">
                Your password has been reset successfully. Redirecting to sign in...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="p-6 sm:p-12 sm:shadow-xl sm:border sm:border-border/40 sm:bg-card sm:rounded-3xl">
        <div className="space-y-8">
          <div className="flex justify-center">
            <div className="w-28 h-28 relative">
              <Image
                src="/BSVG.svg"
                alt="BerryTap Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
              Set new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : null}
          {passwordError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {passwordError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="space-y-0">
              <div className="relative">
                <input
                  id="customer-new-password"
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError(null);
                    if (passwordError) setPasswordError(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 ${
                    passwordError
                      ? "border-red-500 focus:border-red-500"
                      : "border-border/50 focus:border-blue-500"
                  } ${password ? "rounded-t-xl border-b-0" : "rounded-xl"}`}
                />
                <label
                  htmlFor="customer-new-password"
                  className={`absolute left-4 transition-all pointer-events-none ${
                    passwordFocused || password.length > 0
                      ? "top-2 text-xs text-muted-foreground"
                      : "top-1/2 -translate-y-1/2 text-base text-muted-foreground/60"
                  }`}
                >
                  New Password
                </label>
              </div>

              {password ? (
                <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                  <input
                    id="customer-confirm-password"
                    type="password"
                    placeholder=""
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      if (error) setError(null);
                      if (passwordError) setPasswordError(null);
                    }}
                    onFocus={() => setConfirmPasswordFocused(true)}
                    onBlur={() => setConfirmPasswordFocused(false)}
                    required
                    className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border border-border/50 border-t-border/30 rounded-b-xl focus:border-blue-500 focus:outline-none focus:ring-0 transition-all text-foreground ${
                      passwordError ? "border-red-500 focus:border-red-500" : ""
                    }`}
                  />
                  <label
                    htmlFor="customer-confirm-password"
                    className={`absolute left-4 transition-all pointer-events-none ${
                      confirmPasswordFocused || confirmPassword.length > 0
                        ? "top-2 text-xs text-muted-foreground"
                        : "top-1/2 -translate-y-1/2 text-base text-muted-foreground/60"
                    }`}
                  >
                    Confirm Password
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      password.length === 0 || confirmPassword.length === 0 || loading
                    }
                    size="icon"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                      password.length === 0 || confirmPassword.length === 0 || loading
                        ? "opacity-40 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    <span className="sr-only">Submit</span>
                  </Button>
                </div>
              ) : null}
            </div>
          </form>

          <div className="flex flex-col items-center gap-2 pt-6 text-sm">
            <Link
              href="/login"
              className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
            >
              Back to sign in
            </Link>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground pt-2">
              Resetting password…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
