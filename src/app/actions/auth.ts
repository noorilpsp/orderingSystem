"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { users } from "@/db/schema";
import { preCacheAdminStatus } from "@/lib/permissions";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional().default(false),
});

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  fullName: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
});

export async function login(data: {
  email: string;
  password: string;
  remember?: boolean;
}) {
  // Validate input
  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const { email: validatedEmail, password: validatedPassword } = validation.data;

  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedEmail,
      password: validatedPassword,
    });

    if (error || !data.session) {
      // Handle email confirmation error
      if (error?.message?.toLowerCase().includes("confirm")) {
        return {
          error: "Please confirm your email before signing in.",
        };
      }

      return {
        error: error?.message || "Invalid email or password",
      };
    }

    // Upsert user profile in Neon via Drizzle
    const userId = data.user.id;
    const userEmail = data.user.email ?? "";
    const fullName =
      (data.user.user_metadata as { full_name?: string } | null)?.full_name ??
      (userEmail.split("@")[0] || "User");
    const lastLoginAt = new Date();

    // Try to upsert user in database, but don't fail login if it fails
    try {
      await db
        .insert(users)
        .values({
          id: userId,
          email: userEmail,
          fullName,
          lastLoginAt,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userEmail,
            fullName,
            lastLoginAt,
          },
        });
    } catch (dbError) {
      // Log database error but don't fail login - user is already authenticated in Supabase
      console.error("Failed to upsert user in database:", dbError);
      // In development, log more details
      if (process.env.NODE_ENV === "development") {
        console.error("Database error details:", {
          userId,
          userEmail,
          fullName,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }
      // Continue with login even if database insert fails
      // The user is authenticated in Supabase, database sync can happen later
    }

    // Pre-cache admin status and set cookie for fast middleware checks
    try {
      const isAdmin = await preCacheAdminStatus(userId);
      await setAdminStatusCookieForServerAction(userId, isAdmin);
    } catch (error) {
      // Don't fail login if admin check fails, just log it
      console.error("Failed to pre-cache admin status:", error);
    }

    // Supabase client sets auth cookies automatically via the server client
    // Return success even if database operations failed - user is authenticated
    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Sets admin status cookie for Server Actions
 * Server Actions can use cookies() from next/headers directly
 */
async function setAdminStatusCookieForServerAction(
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  const cookieStore = await cookies();
  const ADMIN_COOKIE_NAME = "bt_admin_status"; // Must match lib/permissions.ts
  const ADMIN_COOKIE_TTL = 30 * 60; // 30 minutes in seconds (must match lib/permissions.ts)

  const timestamp = Math.floor(Date.now() / 1000);
  const cookieValue = `${userId}:${isAdmin}:${timestamp}`;

  cookieStore.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_COOKIE_TTL,
    path: "/",
  });
}

export async function signup(data: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  returnTo?: string;
}) {
  // Validate input
  const validation = signupSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const {
    email: validatedEmail,
    password: validatedPassword,
    fullName: validatedFullName,
    phone: validatedPhone,
  } = validation.data;

  try {
    // Guard: prevent duplicate emails in our Neon DB
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedEmail))
      .limit(1);

    if (existing.length > 0) {
      return {
        error: "An account with this email already exists. Please sign in instead.",
      };
    }

    const supabase = await supabaseServer();
    
    // Check if this is an invitation signup
    const isInvitationSignup = data.returnTo?.includes('/invite/');
    let supabaseData: { user: any; session: any } | null = null;
    let error: any = null;
    let finalSession: any = null;

    // For invitation signups, use Admin API to create user directly with email confirmed
    // This prevents the confirmation email from being sent
    if (isInvitationSignup && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        console.log('[signup] Using Admin API for invitation signup (no confirmation email)');
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        );

        // Create user directly with email confirmed (no confirmation email sent)
        const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
          email: validatedEmail,
          password: validatedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: validatedFullName,
            phone: validatedPhone,
          },
        });

        if (adminError) {
          console.error('[signup] Admin API create user error:', adminError);
          // If user already exists, try to sign in instead
          if (adminError.message?.toLowerCase().includes('already registered') || 
              adminError.message?.toLowerCase().includes('user already')) {
            // User exists, try to sign in
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: validatedEmail,
              password: validatedPassword,
            });
            
            if (signInError || !signInData.session) {
              return {
                error: "An account with this email already exists. Please sign in instead.",
              };
            }
            
            supabaseData = { user: signInData.user, session: signInData.session };
            finalSession = signInData.session;
          } else {
            error = adminError;
          }
        } else if (adminData.user) {
          // User created successfully, now sign them in to get a session
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: validatedEmail,
            password: validatedPassword,
          });

          if (signInError) {
            console.error('[signup] Failed to sign in after admin create:', signInError);
            error = signInError;
          } else if (signInData.session) {
            supabaseData = { user: adminData.user, session: signInData.session };
            finalSession = signInData.session;
            console.log('[signup] Invitation signup successful - user created and signed in (no confirmation email sent)');
          } else {
            error = new Error('Failed to create session after user creation');
          }
        }
      } catch (adminError) {
        console.error('[signup] Error in Admin API flow:', adminError);
        error = adminError;
      }
    }

    // Fallback to normal signup flow if not invitation or Admin API failed
    if (!supabaseData && !error) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: validatedEmail,
        password: validatedPassword,
        options: {
          data: {
            full_name: validatedFullName,
            phone: validatedPhone,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/staff/login`,
        },
      });

      supabaseData = data;
      error = signUpError;
      finalSession = data?.session;
    }

    // Log detailed signup response for debugging
    console.log("Signup response:", {
      isInvitationSignup,
      hasUser: !!supabaseData?.user,
      hasSession: !!finalSession,
      userEmail: supabaseData?.user?.email,
      userConfirmed: supabaseData?.user?.email_confirmed_at ? "Yes" : "No",
      error: error?.message,
    });

    if (error) {
      console.error("Supabase signup error:", error);
      // If the email already exists, return a conflict status
      if (error.message?.toLowerCase().includes("already registered") || 
          error.message?.toLowerCase().includes("user already")) {
        return {
          error: "An account with this email already exists. Please sign in instead.",
        };
      }

      return {
        error: error.message,
      };
    }
    if (supabaseData?.user) {
      const userMeta = supabaseData.user.user_metadata || {};
      const fullName =
        validatedFullName ||
        userMeta.full_name ||
        userMeta.name ||
        validatedEmail.split("@")[0] ||
        "User";
      const phone = validatedPhone || userMeta.phone || null;
      const avatarUrl = userMeta.avatar_url || null;
      const locale = userMeta.locale || "nl-BE";

      try {
        await db
          .insert(users)
          .values({
            id: supabaseData.user.id,
            email: supabaseData.user.email ?? validatedEmail,
            phone,
            fullName,
            avatarUrl,
            locale,
            isActive: true,
            createdAt: supabaseData.user.created_at
              ? new Date(supabaseData.user.created_at)
              : undefined,
            updatedAt: new Date(),
            lastLoginAt: null,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: supabaseData.user.email ?? validatedEmail,
              phone,
              fullName,
              avatarUrl,
              locale,
              updatedAt: new Date(),
            },
          });
      } catch (dbError) {
        console.error("Database insert error:", dbError);
        // In development, provide more details about the error
        if (process.env.NODE_ENV === "development") {
          // Re-throw to see the actual error in development
          throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }
        // In production, we still return success from Supabase signup
        // The user exists in Supabase auth, database sync can happen later
      }
    }

    return {
      success: true,
      user: supabaseData.user,
      session: finalSession, // may be null if email confirmation required
    };
  } catch (error) {
    console.error("Signup error:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for common database errors
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        return {
          error: "Database configuration error. Please contact support.",
        };
      }
      
      // Check for connection errors
      if (error.message.includes("connect") || error.message.includes("ECONNREFUSED")) {
        return {
          error: "Unable to connect to the database. Please try again later.",
        };
      }
      
      // Check for Supabase errors
      if (error.message.includes("Supabase") || error.message.includes("SUPABASE")) {
        return {
          error: "Authentication service error. Please check your configuration.",
        };
      }
      
      // Return the actual error message for debugging (in development)
      if (process.env.NODE_ENV === "development") {
        return {
          error: `Error: ${error.message}`,
        };
      }
    }
    
    return {
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();

    // Clear admin status cookie if it exists
    const cookieStore = await cookies();
    cookieStore.delete("bt_admin_status");
    cookieStore.delete("current_merchant");
    cookieStore.delete("current_location");
    
    // Note: localStorage clearing must be done client-side
    // The client-side logout handler should call clearUserData() before this
  } catch (error) {
    console.error("Logout error:", error);
  }
  
  // Always redirect to staff login page (redirect throws, so this never returns)
  redirect("/staff/login");
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function forgotPassword(data: { email: string }) {
  // Validate input
  const validation = forgotPasswordSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const { email: validatedEmail } = validation.data;

  try {
    const supabase = await supabaseServer();

    // Send password reset email
    // Note: Supabase will send the email with a reset link
    // We don't check for errors here to prevent email enumeration attacks
    await supabase.auth.resetPasswordForEmail(validatedEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/staff/reset-password`,
    });

    // Always return success to prevent email enumeration
    // Don't reveal if email exists or not for security
    return {
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    // Still return success message for security
    return {
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  }
}

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export async function resetPassword(data: { password: string }) {
  // Validate input
  const validation = resetPasswordSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const { password: validatedPassword } = validation.data;

  try {
    const supabase = await supabaseServer();

    // Check if we have a valid authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: "No valid session found. Please use the reset link from your email.",
      };
    }

    // Update the user's password
    const { error } = await supabase.auth.updateUser({
      password: validatedPassword,
    });

    if (error) {
      return {
        error: error.message || "Failed to reset password",
      };
    }

    return {
      success: true,
      message: "Password reset successfully",
    };
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

