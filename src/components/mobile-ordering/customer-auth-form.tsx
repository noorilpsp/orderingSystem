"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { customerLogin, customerSignup } from "@/app/actions/customer-auth";
import { PhoneNumberField } from "@/components/shared/phone-number-field";
import { useStorePhoneCountry } from "@/lib/public-menu/use-store-phone-country";
import { isGuestStorePathname } from "@/lib/public-menu/guestMenuPaths";

type CustomerAuthMode = "login" | "signup";

type CustomerAuthFormProps = {
  mode: CustomerAuthMode;
  returnTo?: string;
  storeSlug?: string | null;
  defaultPhoneCountry?: string | null;
};

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 180 130"
      version="1.1"
      className="w-5 h-5 flex-shrink-0 text-blue-500 -ml-2"
    >
      <g transform="matrix(1 0 0 1 85.49510009765618 114.2884521484375)">
        <path
          fill="currentColor"
          d="M84.5703-17.334L84.5215-66.4551C84.5215-69.2383 82.7148-71.1914 79.7852-71.1914L30.6641-71.1914C27.9297-71.1914 26.0742-69.0918 26.0742-66.748C26.0742-64.4043 28.1738-62.4023 30.4688-62.4023L47.4609-62.4023L71.2891-63.1836L62.207-55.2246L13.8184-6.73828C12.9395-5.85938 12.4512-4.73633 12.4512-3.66211C12.4512-1.31836 14.5508 0.878906 16.9922 0.878906C18.1152 0.878906 19.1895 0.488281 20.0684-0.439453L68.5547-48.877L76.6113-58.0078L75.7324-35.2051L75.7324-17.1387C75.7324-14.8438 77.7344-12.6953 80.127-12.6953C82.4707-12.6953 84.5703-14.6973 84.5703-17.334Z"
        />
      </g>
    </svg>
  );
}

function floatingLabelClass(active: boolean) {
  return `absolute left-4 transition-all pointer-events-none ${
    active
      ? "top-2 text-xs text-muted-foreground"
      : "top-1/2 -translate-y-1/2 text-base text-muted-foreground/60"
  }`;
}

export function CustomerAuthForm({
  mode,
  returnTo,
  storeSlug = null,
  defaultPhoneCountry = null,
}: CustomerAuthFormProps) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">(isSignup ? "password" : "email");
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const phoneCountry = useStorePhoneCountry(defaultPhoneCountry, storeSlug, returnTo);
  const authQuery = (() => {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    if (storeSlug) params.set("store", storeSlug);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const alternateHref = isSignup ? `/login${authQuery}` : `/signup${authQuery}`;

  const showName = isSignup;
  const showPhone = isSignup;
  const showEmail = true;
  const showPassword = isSignup || step === "password";

  const isValidPhone = phone.replace(/\D/g, "").length >= 7;

  const advanceFromEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFieldError("Please enter a valid email address");
      return;
    }
    setFieldError(null);
    setStep("password");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    if (!isSignup && step === "email") {
      advanceFromEmail();
      return;
    }

    if (isSignup && !name.trim()) {
      setFieldError("Name is required");
      return;
    }
    if (isSignup && !isValidPhone) {
      setFieldError("Please enter a valid mobile number");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError("Please enter a valid email address");
      return;
    }
    if (isSignup && password.length < 6) {
      setFieldError("Password must be at least 6 characters");
      return;
    }
    if (!email || !password || (isSignup && (!name.trim() || !isValidPhone))) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const result = await customerSignup({
          email,
          password,
          name: name.trim(),
          phone: phone.trim(),
          returnTo,
        });
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        if (result && "needsEmailConfirmation" in result && result.needsEmailConfirmation) {
          setNeedsConfirmation(true);
        }
        return;
      }

      const result = await customerLogin({ email, password, returnTo });
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
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
                Check your email
              </h1>
              <p className="text-muted-foreground">
                We&apos;ve sent a confirmation email to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to confirm your account, then sign in.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-6 text-sm">
              <p className="text-muted-foreground">
                Already confirmed?{" "}
                <Link
                  href={alternateHref}
                  className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const emailConnectedBottom = !isSignup && showPassword;

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
              {isSignup ? "Create your BerryTap account" : "Sign in to BerryTap"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignup
                ? "One account works at every restaurant"
                : "Enter your credentials to continue"}
            </p>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : null}
          {fieldError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {fieldError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className={isSignup ? "space-y-3" : "space-y-0"}>
            <div className={isSignup ? "space-y-3" : "space-y-0"}>
              {showName ? (
                <div className="relative">
                  <input
                    id="customer-name"
                    type="text"
                    autoComplete="name"
                    placeholder=""
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (error) setError(null);
                      if (fieldError) setFieldError(null);
                    }}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    required
                    className={`w-full h-14 px-4 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 rounded-xl ${
                      fieldError
                        ? "border-red-500 focus:border-red-500"
                        : "border-border/50 focus:border-blue-500"
                    }`}
                  />
                  <label
                    htmlFor="customer-name"
                    className={floatingLabelClass(nameFocused || name.length > 0)}
                  >
                    Name
                  </label>
                </div>
              ) : null}

              {showPhone ? (
                <div className="relative">
                  <PhoneNumberField
                    id="customer-phone"
                    value={phone}
                    onChange={(next) => {
                      setPhone(next);
                      if (error) setError(null);
                      if (fieldError) setFieldError(null);
                    }}
                    invalid={Boolean(fieldError)}
                    placeholder="Mobile number"
                    defaultCountry={phoneCountry}
                    triggerClassName={`h-14 rounded-xl ${
                      fieldError ? "border-red-500" : "border-border/50"
                    }`}
                    inputClassName={`h-14 rounded-xl bg-background px-4 text-base shadow-none focus-visible:border-blue-500 focus-visible:ring-0 ${
                      fieldError ? "border-red-500" : "border-border/50"
                    }`}
                  />
                </div>
              ) : null}

              {showEmail ? (
                <div className="relative">
                  <input
                    id="customer-email"
                    type="email"
                    autoComplete="email"
                    placeholder=""
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                      if (fieldError) setFieldError(null);
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border transition-all text-foreground focus:outline-none focus:ring-0 ${
                      fieldError
                        ? "border-red-500 focus:border-red-500"
                        : "border-border/50 focus:border-blue-500"
                    } ${
                      emailConnectedBottom
                        ? "rounded-t-xl border-b-0"
                        : "rounded-xl"
                    }`}
                  />
                  <label
                    htmlFor="customer-email"
                    className={floatingLabelClass(emailFocused || email.length > 0)}
                  >
                    Email
                  </label>
                  {!showPassword ? (
                    <Button
                      type="button"
                      onClick={advanceFromEmail}
                      disabled={email.length === 0 || loading || !!fieldError}
                      size="icon"
                      className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                        email.length === 0 || loading || !!fieldError
                          ? "opacity-40 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                      <span className="sr-only">Continue</span>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {showPassword ? (
                <div className={`relative ${isSignup ? "" : "animate-in fade-in slide-in-from-top-2 duration-300"}`}>
                  <input
                    id="customer-password"
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder=""
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError(null);
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    minLength={isSignup ? 6 : 1}
                    autoFocus={!isSignup}
                    className={`w-full h-14 px-4 pr-14 pt-5 pb-1 text-base bg-background border border-border/50 focus:border-blue-500 focus:outline-none focus:ring-0 transition-all text-foreground ${
                      isSignup
                        ? "rounded-xl"
                        : "border-t-border/30 rounded-b-xl"
                    }`}
                  />
                  <label
                    htmlFor="customer-password"
                    className={floatingLabelClass(passwordFocused || password.length > 0)}
                  >
                    Password
                  </label>
                  <Button
                    type="submit"
                    disabled={password.length === 0 || loading}
                    size="icon"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-border/30 hover:bg-border/50 text-foreground shadow-sm transition-all flex-shrink-0 ${
                      password.length === 0 || loading
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
            {!isSignup ? (
              <Link
                href="/forgot-password"
                className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal flex items-center gap-0.5 cursor-pointer"
              >
                Forgot password?
                <ExternalLinkIcon />
              </Link>
            ) : null}
            <p className="text-muted-foreground">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
              <Link
                href={alternateHref}
                className="text-blue-500 hover:text-blue-600 hover:underline transition-colors font-normal"
              >
                {isSignup ? "Sign in" : "Create account"}
              </Link>
            </p>
            {returnTo && isGuestStorePathname(returnTo) ? (
              <Link
                href={returnTo}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-normal"
              >
                Continue as guest
              </Link>
            ) : null}
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground pt-2">
              {isSignup ? "Creating account…" : "Signing in…"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
