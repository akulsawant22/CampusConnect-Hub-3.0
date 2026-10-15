import { z } from "zod";

// ============================================================================
// Event Form Validation & Invariants
// ============================================================================

export const eventSchema = z
  .object({
    title: z
      .string({ required_error: "Title is required" })
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(160, "Title cannot exceed 160 characters"),
    description: z
      .string()
      .trim()
      .max(5000, "Description cannot exceed 5000 characters")
      .default(""),
    category: z.string().trim().max(40, "Category cannot exceed 40 characters").default("general"),
    venue: z.string().trim().max(160, "Venue cannot exceed 160 characters").default(""),
    starts_at: z.string().min(1, "Start time is required"),
    ends_at: z.string().min(1, "End time is required"),
    registration_deadline: z.string().min(1, "Registration deadline is required"),
    capacity: z
      .number({ invalid_type_error: "Capacity must be a number" })
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1")
      .max(100000, "Capacity cannot exceed 100,000"),
  })
  .refine(
    (data) => {
      const start = new Date(data.starts_at).getTime();
      const end = new Date(data.ends_at).getTime();
      return !isNaN(start) && !isNaN(end) && end > start;
    },
    {
      message: "End time must be after start time",
      path: ["ends_at"],
    },
  )
  .refine(
    (data) => {
      const deadline = new Date(data.registration_deadline).getTime();
      const start = new Date(data.starts_at).getTime();
      return !isNaN(deadline) && !isNaN(start) && deadline <= start;
    },
    {
      message: "Registration deadline must be on or before start time",
      path: ["registration_deadline"],
    },
  );

export type EventFormData = z.infer<typeof eventSchema>;

export function validateEventInput(
  input: unknown,
  currentRegisteredCount = 0,
): {
  success: boolean;
  data?: EventFormData;
  error?: string;
  fieldErrors?: Record<string, string>;
} {
  const result = eventSchema.safeParse(input);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] || "general");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      success: false,
      error: firstIssue?.message ?? "Invalid event details",
      fieldErrors,
    };
  }

  // Database Invariant Guard Check: Capacity cannot be reduced below active registered count
  if (currentRegisteredCount > 0 && result.data.capacity < currentRegisteredCount) {
    const errorMsg = `Cannot reduce capacity to ${result.data.capacity}: event already has ${currentRegisteredCount} active registration(s)`;
    return {
      success: false,
      error: errorMsg,
      fieldErrors: { capacity: errorMsg },
    };
  }

  return { success: true, data: result.data };
}

// ============================================================================
// Auth Form Validation
// ============================================================================

export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long");

export const signUpSchema = z.object({
  fullName: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name cannot exceed 120 characters"),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export function validateEmail(email: string): string | null {
  const res = emailSchema.safeParse(email);
  return res.success ? null : (res.error.issues[0]?.message ?? "Invalid email");
}

export function validatePassword(password: string): string | null {
  const res = passwordSchema.safeParse(password);
  return res.success ? null : (res.error.issues[0]?.message ?? "Invalid password");
}

export function validateSignUp(data: {
  fullName: string;
  email: string;
  password: string;
}): string | null {
  const res = signUpSchema.safeParse(data);
  return res.success ? null : (res.error.issues[0]?.message ?? "Invalid registration details");
}

export function validateSignIn(data: { email: string; password: string }): string | null {
  const res = signInSchema.safeParse(data);
  return res.success ? null : (res.error.issues[0]?.message ?? "Invalid sign-in details");
}

// ============================================================================
// Feedback Validation
// ============================================================================

export const feedbackSchema = z.object({
  rating: z
    .number({ invalid_type_error: "Rating must be a number" })
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z
    .string()
    .trim()
    .max(2000, "Comment cannot exceed 2000 characters")
    .optional()
    .nullable(),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;

export function validateFeedback(data: unknown): {
  success: boolean;
  data?: FeedbackFormData;
  error?: string;
} {
  const res = feedbackSchema.safeParse(data);
  if (!res.success) {
    return {
      success: false,
      error: res.error.issues[0]?.message ?? "Invalid feedback",
    };
  }
  return { success: true, data: res.data };
}

// ============================================================================
// File Upload Validation
// ============================================================================

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateCoverImage(file: { type: string; size: number }): {
  valid: boolean;
  error?: string;
  extension?: string;
} {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    return {
      valid: false,
      error: "Use a JPG, PNG or WebP image",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Image must be under 5 MB",
    };
  }

  return { valid: true, extension: ext };
}
