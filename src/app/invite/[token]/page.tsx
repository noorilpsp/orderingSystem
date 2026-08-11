"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { supabase } from "@/lib/supabaseClient";
import { clearUserData } from "@/lib/utils/logout";

type RouteParams = {
  params: Promise<{ token: string }>;
};

type InvitationData = {
  id: string;
  merchant_id: string;
  merchant_name: string;
  email: string;
  role: string;
  expires_at: string;
};

type InvitationResponse =
  | { success: true; invitation: InvitationData }
  | { success: false; error: string };

type UserSession = {
  email: string | null;
  isAuthenticated: boolean;
};

type AcceptResponse =
  | { success: true; merchant_id: string; redirect: string }
  | { success: false; error: string };

type PageState =
  | "loading"
  | "invalid"
  | "not_logged_in"
  | "email_mismatch"
  | "ready_to_accept"
  | "accepting"
  | "accepted"
  | "accept_failed";

export default function InvitePage({ params }: RouteParams) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Extract token from params
  useEffect(() => {
    params.then((p) => {
      setToken(p.token);
    });
  }, [params]);

  // Fetch invitation and user session
  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        // Fetch invitation details
        const invitationResponse = await fetch(`/api/invitations/${token}`);
        const invitationData: InvitationResponse = await invitationResponse.json();

        if (!invitationData.success) {
          setState("invalid");
          setError(invitationData.error);
          return;
        }

        setInvitation(invitationData.invitation);

        // Check user session using Supabase client
        const supabaseClient = supabase();
        const {
          data: { user },
          error: userError,
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
          setState("not_logged_in");
          setUserSession({ email: null, isAuthenticated: false });
          return;
        }

        const userEmail = user.email;
        setUserSession({ email: userEmail, isAuthenticated: true });

        // Check email match
        if (
          userEmail?.toLowerCase() !==
          invitationData.invitation.email.toLowerCase()
        ) {
          setState("email_mismatch");
          return;
        }

        setState("ready_to_accept");
      } catch (err) {
        console.error("[invite-page] Error fetching data:", err);
        setState("invalid");
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load invitation. Please try again.",
        );
      }
    }

    fetchData();
  }, [token]);

  const handleAccept = async () => {
    if (!token || !invitation) return;

    setState("accepting");
    setAcceptError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data: AcceptResponse = await response.json();

      if (!data.success) {
        setState("ready_to_accept");
        setAcceptError(data.error);
        return;
      }

      setState("accepted");

      // Auto-redirect after 1 second
      setTimeout(() => {
        router.push(data.redirect || "/dashboard");
      }, 1000);
    } catch (err) {
      setState("ready_to_accept");
      setAcceptError(
        err instanceof Error
          ? err.message
          : "Failed to accept invitation. Please try again.",
      );
    }
  };

  const handleLogout = async () => {
    // Clear all client-side user data before server-side logout
    clearUserData()
    await logout();
    window.location.href = `/invite/${token}`;
  };

  const signupUrl = `/staff/signup?returnTo=${encodeURIComponent(
    `/invite/${token}`,
  )}${invitation ? `&email=${encodeURIComponent(invitation.email)}` : ""}`;
  const loginUrl = `/staff/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/BerryTapSVG.svg"
            alt="BerryTap Logo"
            width={120}
            height={48}
            className="h-12 w-auto"
          />
        </div>

        {/* STATE 1: LOADING */}
        {state === "loading" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying invitation...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        )}

        {/* STATE 2: INVALID/EXPIRED */}
        {state === "invalid" && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Invalid Invitation
              </CardTitle>
              <CardDescription>
                {error || "This invitation is invalid or has expired."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STATE 3: NOT LOGGED IN */}
        {state === "not_logged_in" && invitation && (
          <Card>
            <CardHeader>
              <CardTitle>You&apos;ve been invited!</CardTitle>
              <CardDescription>
                Join <strong>{invitation.merchant_name}</strong> as{" "}
                <strong>{invitation.role}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  To accept this invitation, please sign up or log in with the
                  email address where you received this invitation:
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {invitation.email}
                </p>
              </div>
              <div className="space-y-2">
                <Button asChild className="w-full" size="lg">
                  <Link href={signupUrl}>Sign Up</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={loginUrl}>Already have an account? Log In</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STATE 4: EMAIL MISMATCH */}
        {state === "email_mismatch" && invitation && userSession && (
          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                <AlertCircle className="h-5 w-5" />
                Email Mismatch
              </CardTitle>
              <CardDescription>
                This invitation was sent to a different email address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Invitation sent to:</strong> {invitation.email}
                </p>
                <p>
                  <strong>You&apos;re logged in as:</strong> {userSession.email}
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-sm text-yellow-800 dark:text-yellow-200">
                Please log out and sign in with the correct email address to
                accept this invitation.
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full gap-2"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STATE 5: READY TO ACCEPT */}
        {state === "ready_to_accept" && invitation && (
          <Card>
            <CardHeader>
              <CardTitle>Accept Invitation</CardTitle>
              <CardDescription>
                You&apos;ve been invited to join{" "}
                <strong>{invitation.merchant_name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Merchant:</span>{" "}
                  <span className="font-medium">{invitation.merchant_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Your role:</span>{" "}
                  <span className="font-medium capitalize">
                    {invitation.role}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires on:</span>{" "}
                  <span className="font-medium">
                    {new Intl.DateTimeFormat("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                    }).format(new Date(invitation.expires_at))}
                  </span>
                </div>
              </div>
              {acceptError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                  {acceptError}
                </div>
              )}
              <Button
                onClick={handleAccept}
                className="w-full"
                size="lg"
                disabled={state === "accepting"}
              >
                {state === "accepting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STATE 6: ACCEPTING (handled in button above) */}

        {/* STATE 7: ACCEPTED */}
        {state === "accepted" && invitation && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                Invitation Accepted!
              </CardTitle>
              <CardDescription>
                Welcome to <strong>{invitation.merchant_name}</strong>!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Redirecting to your dashboard...
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STATE 8: ACCEPT FAILED (handled in ready_to_accept state above) */}
      </div>
    </div>
  );
}

