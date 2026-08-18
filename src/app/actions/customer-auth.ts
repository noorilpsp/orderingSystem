"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db";
import { users } from "@/db/schema";
import { customers } from "@/lib/db/schema/orders";
import { getLoggedInCustomer } from "@/lib/public-menu/getLoggedInCustomer";
import { ensureCustomerForUser } from "@/lib/public-menu/ensureCustomerForUser";

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid mobile number")
    .max(50)
    .refine((value) => value.replace(/\D/g, "").length >= 7, "Please enter a valid mobile number"),
  returnTo: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  returnTo: z.string().optional(),
});

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/** Post-login/signup: only /menu/* or /account (never dashboard/staff). */
function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/account";
  const trimmed = returnTo.trim();
  if (!isSafeRelativePath(trimmed)) return "/account";
  if (trimmed.startsWith("/menu/")) return trimmed;
  if (trimmed === "/account" || trimmed.startsWith("/account?")) return trimmed;
  return "/account";
}

function sanitizeLogoutReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/login";
  const trimmed = returnTo.trim();
  if (!isSafeRelativePath(trimmed)) return "/login";
  if (
    trimmed === "/login" ||
    trimmed.startsWith("/login?") ||
    trimmed.startsWith("/menu/") ||
    trimmed === "/account" ||
    trimmed.startsWith("/account?")
  ) {
    return trimmed;
  }
  return "/login";
}

async function upsertNeonUser(input: {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  lastLoginAt?: Date | null;
}) {
  await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone?.trim() || null,
      isActive: true,
      lastLoginAt: input.lastLoginAt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        fullName: input.fullName,
        ...(input.phone != null ? { phone: input.phone.trim() || null } : {}),
        lastLoginAt: input.lastLoginAt ?? undefined,
        updatedAt: new Date(),
      },
    });
}

export async function customerSignup(data: {
  email: string;
  password: string;
  name: string;
  phone: string;
  returnTo?: string;
}) {
  const validation = signupSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid input" };
  }

  const { email, password, name, phone, returnTo } = validation.data;
  const nextPath = sanitizeReturnTo(returnTo);

  try {
    const existingRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (existingRows.length > 0) {
      return { error: "An account with this email already exists. Please sign in instead." };
    }

    const supabase = await supabaseServer();
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/login`,
      },
    });

    if (error) {
      if (
        error.message?.toLowerCase().includes("already registered") ||
        error.message?.toLowerCase().includes("user already")
      ) {
        return { error: "An account with this email already exists. Please sign in instead." };
      }
      return { error: error.message };
    }

    if (!signUpData.user) {
      return { error: "Unable to create account. Please try again." };
    }

    try {
      await upsertNeonUser({
        id: signUpData.user.id,
        email: signUpData.user.email ?? email,
        fullName: name,
        phone,
        lastLoginAt: signUpData.session ? new Date() : null,
      });
    } catch (dbError) {
      console.error("[customerSignup] Failed to upsert users row:", dbError);
    }

    if (!signUpData.session) {
      return {
        success: true as const,
        needsEmailConfirmation: true as const,
        message: "Check your email to confirm your account, then sign in.",
      };
    }

    redirect(nextPath);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[customerSignup]", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function customerLogin(data: {
  email: string;
  password: string;
  returnTo?: string;
}) {
  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid input" };
  }

  const { email, password, returnTo } = validation.data;
  const nextPath = sanitizeReturnTo(returnTo);

  try {
    const supabase = await supabaseServer();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !signInData.session || !signInData.user) {
      if (error?.message?.toLowerCase().includes("confirm")) {
        return { error: "Please confirm your email before signing in." };
      }
      return { error: error?.message || "Invalid email or password" };
    }

    const fullName =
      (signInData.user.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
      (signInData.user.user_metadata as { name?: string } | null)?.name ||
      email.split("@")[0] ||
      "Guest";

    try {
      await upsertNeonUser({
        id: signInData.user.id,
        email: signInData.user.email ?? email,
        fullName,
        lastLoginAt: new Date(),
      });
    } catch (dbError) {
      console.error("[customerLogin] Failed to upsert users row:", dbError);
    }

    redirect(nextPath);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[customerLogin]", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function customerLogout(returnTo?: string) {
  const nextPath = sanitizeLogoutReturnTo(returnTo);
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[customerLogout]", error);
  }
  redirect(nextPath);
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function customerForgotPassword(data: { email: string }) {
  const validation = forgotPasswordSchema.safeParse(data);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(validation.data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`,
    });
    return {
      success: true as const,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  } catch (error) {
    console.error("[customerForgotPassword]", error);
    return {
      success: true as const,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  }
}

export async function fetchLoggedInCustomerAction(storeSlug?: string | null) {
  try {
    const customer = await getLoggedInCustomer(storeSlug);
    return { ok: true as const, customer };
  } catch (error) {
    console.error("[fetchLoggedInCustomerAction]", error);
    return { ok: false as const, customer: null, error: "Failed to load account" };
  }
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid mobile number")
    .max(50)
    .refine((value) => value.replace(/\D/g, "").length >= 7, "Please enter a valid mobile number"),
  storeSlug: z.string().trim().optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function updateCustomerProfile(data: {
  name: string;
  phone: string;
  storeSlug?: string | null;
}) {
  const validation = updateProfileSchema.safeParse({
    name: data.name,
    phone: data.phone,
    storeSlug: data.storeSlug?.trim() || undefined,
  });
  if (!validation.success) {
    return { ok: false as const, error: validation.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { ok: false as const, error: "Please sign in again." };
    }

    const name = validation.data.name;
    const phone = validation.data.phone;
    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: name, phone },
    });
    if (metaError) {
      return { ok: false as const, error: metaError.message || "Unable to update profile." };
    }

    const now = new Date();
    await db
      .update(users)
      .set({ fullName: name, phone, updatedAt: now })
      .where(eq(users.id, user.id));

    await db
      .update(customers)
      .set({ name, phone })
      .where(eq(customers.userId, user.id));

    if (validation.data.storeSlug) {
      await ensureCustomerForUser({
        userId: user.id,
        storeSlug: validation.data.storeSlug,
        name,
        email: user.email ?? null,
        phone,
      });
    }

    return { ok: true as const, name, phone };
  } catch (error) {
    console.error("[updateCustomerProfile]", error);
    return { ok: false as const, error: "Unable to update profile. Please try again." };
  }
}

export async function updateCustomerPassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const validation = updatePasswordSchema.safeParse(data);
  if (!validation.success) {
    return { ok: false as const, error: validation.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      return { ok: false as const, error: "Please sign in again." };
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: validation.data.currentPassword,
    });
    if (reauthError) {
      return { ok: false as const, error: "Current password is incorrect." };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: validation.data.newPassword,
    });
    if (updateError) {
      return { ok: false as const, error: updateError.message || "Unable to update password." };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("[updateCustomerPassword]", error);
    return { ok: false as const, error: "Unable to update password. Please try again." };
  }
}
