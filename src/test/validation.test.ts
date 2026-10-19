import { describe, expect, it } from "vitest";
import {
  eventSchema,
  validateEventInput,
  validateEmail,
  validatePassword,
  validateSignUp,
  validateSignIn,
  validateFeedback,
  validateCoverImage,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validation";

describe("Milestone 2: Validation, Constraints & Invariants", () => {
  // ==========================================================================
  // 1. Event Validation & Boundary Conditions
  // ==========================================================================
  describe("Event Schema & Boundary Tests", () => {
    const baseValidEvent = {
      title: "Campus Hackathon 2026",
      description: "Annual hackathon for students",
      category: "Technology",
      venue: "Main Auditorium",
      starts_at: "2026-11-01T10:00:00.000Z",
      ends_at: "2026-11-01T18:00:00.000Z",
      registration_deadline: "2026-10-31T23:59:59.000Z",
      capacity: 100,
    };

    it("accepts a well-formed event within all boundaries", () => {
      const res = eventSchema.safeParse(baseValidEvent);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.title).toBe("Campus Hackathon 2026");
        expect(res.data.capacity).toBe(100);
      }
    });

    describe("Title Boundaries (min 3, max 160)", () => {
      it("rejects title with fewer than 3 characters", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, title: "AI" });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("at least 3 characters");
        }
      });

      it("accepts title with exactly 3 characters", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, title: "Lab" });
        expect(res.success).toBe(true);
      });

      it("accepts title with exactly 160 characters", () => {
        const title160 = "A".repeat(160);
        const res = eventSchema.safeParse({ ...baseValidEvent, title: title160 });
        expect(res.success).toBe(true);
      });

      it("rejects title with 161 characters", () => {
        const title161 = "A".repeat(161);
        const res = eventSchema.safeParse({ ...baseValidEvent, title: title161 });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("cannot exceed 160 characters");
        }
      });

      it("rejects title that is whitespace only", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, title: "   " });
        expect(res.success).toBe(false);
      });
    });

    describe("Description Boundaries (max 5000)", () => {
      it("accepts description up to 5000 characters", () => {
        const desc5000 = "D".repeat(5000);
        const res = eventSchema.safeParse({ ...baseValidEvent, description: desc5000 });
        expect(res.success).toBe(true);
      });

      it("rejects description exceeding 5000 characters", () => {
        const desc5001 = "D".repeat(5001);
        const res = eventSchema.safeParse({ ...baseValidEvent, description: desc5001 });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("cannot exceed 5000 characters");
        }
      });
    });

    describe("Capacity Boundaries (1 to 100,000 integer)", () => {
      it("accepts lower boundary capacity of 1", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: 1 });
        expect(res.success).toBe(true);
      });

      it("accepts upper boundary capacity of 100,000", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: 100000 });
        expect(res.success).toBe(true);
      });

      it("rejects capacity of 0", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: 0 });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("Capacity must be at least 1");
        }
      });

      it("rejects negative capacity", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: -5 });
        expect(res.success).toBe(false);
      });

      it("rejects non-integer capacity", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: 25.5 });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("whole number");
        }
      });

      it("rejects capacity exceeding 100,000", () => {
        const res = eventSchema.safeParse({ ...baseValidEvent, capacity: 100001 });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("cannot exceed 100,000");
        }
      });
    });

    describe("Date Ordering Constraints", () => {
      it("rejects when ends_at is earlier than starts_at", () => {
        const res = eventSchema.safeParse({
          ...baseValidEvent,
          starts_at: "2026-11-01T15:00:00.000Z",
          ends_at: "2026-11-01T10:00:00.000Z",
        });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("End time must be after start time");
        }
      });

      it("rejects when ends_at equals starts_at", () => {
        const res = eventSchema.safeParse({
          ...baseValidEvent,
          starts_at: "2026-11-01T10:00:00.000Z",
          ends_at: "2026-11-01T10:00:00.000Z",
        });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain("End time must be after start time");
        }
      });

      it("rejects when registration_deadline is after starts_at", () => {
        const res = eventSchema.safeParse({
          ...baseValidEvent,
          starts_at: "2026-11-01T10:00:00.000Z",
          ends_at: "2026-11-01T18:00:00.000Z",
          registration_deadline: "2026-11-01T12:00:00.000Z", // after start!
        });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.issues[0]?.message).toContain(
            "Registration deadline must be on or before start time",
          );
        }
      });

      it("accepts when registration_deadline exactly equals starts_at", () => {
        const res = eventSchema.safeParse({
          ...baseValidEvent,
          starts_at: "2026-11-01T10:00:00.000Z",
          ends_at: "2026-11-01T18:00:00.000Z",
          registration_deadline: "2026-11-01T10:00:00.000Z",
        });
        expect(res.success).toBe(true);
      });

      it("accepts when registration_deadline is before starts_at", () => {
        const res = eventSchema.safeParse({
          ...baseValidEvent,
          starts_at: "2026-11-01T10:00:00.000Z",
          ends_at: "2026-11-01T18:00:00.000Z",
          registration_deadline: "2026-10-31T18:00:00.000Z",
        });
        expect(res.success).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 2. Capacity Invariant Guard (Frontend and DB Simulation)
  // ==========================================================================
  describe("Capacity Invariant Guard", () => {
    const validEventData = {
      title: "Workshop on Next.js",
      description: "Learn Next.js App Router",
      category: "Tech",
      venue: "Hall B",
      starts_at: "2026-12-01T10:00:00.000Z",
      ends_at: "2026-12-01T14:00:00.000Z",
      registration_deadline: "2026-11-30T23:59:00.000Z",
      capacity: 50,
    };

    it("allows increasing capacity regardless of registered count", () => {
      const res = validateEventInput({ ...validEventData, capacity: 100 }, 30);
      expect(res.success).toBe(true);
      expect(res.data?.capacity).toBe(100);
    });

    it("allows setting capacity equal to the active registered count", () => {
      const res = validateEventInput({ ...validEventData, capacity: 30 }, 30);
      expect(res.success).toBe(true);
      expect(res.data?.capacity).toBe(30);
    });

    it("blocks reducing capacity below active registered count", () => {
      const res = validateEventInput({ ...validEventData, capacity: 25 }, 30);
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        "Cannot reduce capacity to 25: event already has 30 active registration(s)",
      );
      expect(res.fieldErrors?.["capacity"]).toContain("Cannot reduce capacity");
    });

    it("allows any valid capacity when there are 0 active registrations", () => {
      const res = validateEventInput({ ...validEventData, capacity: 5 }, 0);
      expect(res.success).toBe(true);
    });

    // Database Trigger Simulation of public.events_guard()
    describe("Database Trigger Simulation (events_guard)", () => {
      interface SimulatedEvent {
        id: string;
        organizer_id: string;
        capacity: number;
        status: string;
      }
      interface SimulatedRegistration {
        id: string;
        event_id: string;
        status: "registered" | "cancelled";
      }

      function simulateEventsGuardTrigger(
        oldEvent: SimulatedEvent,
        newEvent: SimulatedEvent,
        registrations: SimulatedRegistration[],
        callerRoles: string[],
      ): SimulatedEvent {
        // 1. Check organizer immutability
        if (newEvent.organizer_id !== oldEvent.organizer_id && !callerRoles.includes("admin")) {
          throw new Error("Cannot change event organizer");
        }

        // 2. Check capacity reduction invariant
        if (newEvent.capacity < oldEvent.capacity) {
          const activeRegistrationsCount = registrations.filter(
            (r) => r.event_id === newEvent.id && r.status === "registered",
          ).length;

          if (newEvent.capacity < activeRegistrationsCount) {
            throw new Error(
              `Cannot reduce capacity to ${newEvent.capacity}: event has ${activeRegistrationsCount} active registrations`,
            );
          }
        }

        return newEvent;
      }

      it("permits reducing capacity when above active registrations", () => {
        const oldEv: SimulatedEvent = {
          id: "ev1",
          organizer_id: "org1",
          capacity: 100,
          status: "published",
        };
        const newEv: SimulatedEvent = { ...oldEv, capacity: 50 };
        const regs: SimulatedRegistration[] = [
          { id: "r1", event_id: "ev1", status: "registered" },
          { id: "r2", event_id: "ev1", status: "registered" },
          { id: "r3", event_id: "ev1", status: "cancelled" }, // cancelled doesn't block reduction
        ];

        expect(() => simulateEventsGuardTrigger(oldEv, newEv, regs, ["organizer"])).not.toThrow();
      });

      it("throws invariant error when reducing capacity below active registrations", () => {
        const oldEv: SimulatedEvent = {
          id: "ev1",
          organizer_id: "org1",
          capacity: 100,
          status: "published",
        };
        const newEv: SimulatedEvent = { ...oldEv, capacity: 2 };
        const regs: SimulatedRegistration[] = [
          { id: "r1", event_id: "ev1", status: "registered" },
          { id: "r2", event_id: "ev1", status: "registered" },
          { id: "r3", event_id: "ev1", status: "registered" },
        ];

        expect(() => simulateEventsGuardTrigger(oldEv, newEv, regs, ["organizer"])).toThrow(
          "Cannot reduce capacity to 2: event has 3 active registrations",
        );
      });

      it("ignores cancelled registrations when enforcing capacity invariant", () => {
        const oldEv: SimulatedEvent = {
          id: "ev1",
          organizer_id: "org1",
          capacity: 10,
          status: "published",
        };
        const newEv: SimulatedEvent = { ...oldEv, capacity: 2 };
        const regs: SimulatedRegistration[] = [
          { id: "r1", event_id: "ev1", status: "registered" },
          { id: "r2", event_id: "ev1", status: "cancelled" },
          { id: "r3", event_id: "ev1", status: "cancelled" },
        ];

        // Active count is 1. Capacity is reduced to 2 (2 >= 1). Should succeed!
        expect(() => simulateEventsGuardTrigger(oldEv, newEv, regs, ["organizer"])).not.toThrow();
      });

      it("prevents non-admins from changing event organizer", () => {
        const oldEv: SimulatedEvent = {
          id: "ev1",
          organizer_id: "org1",
          capacity: 10,
          status: "published",
        };
        const newEv: SimulatedEvent = { ...oldEv, organizer_id: "org2" };
        expect(() => simulateEventsGuardTrigger(oldEv, newEv, [], ["organizer"])).toThrow(
          "Cannot change event organizer",
        );
      });
    });
  });

  // ==========================================================================
  // 3. Auth Form Validation
  // ==========================================================================
  describe("Auth Validation (Email, Password, Sign-up)", () => {
    describe("Email Format", () => {
      it("accepts valid email addresses", () => {
        expect(validateEmail("user@campus.edu")).toBeNull();
        expect(validateEmail("first.last+tag@domain.co.in")).toBeNull();
      });

      it("rejects invalid email addresses with clear message", () => {
        expect(validateEmail("not-an-email")).toBe("Please enter a valid email address");
        expect(validateEmail("user@")).toBe("Please enter a valid email address");
        expect(validateEmail("@domain.com")).toBe("Please enter a valid email address");
        expect(validateEmail("   ")).toBe("Email is required");
      });
    });

    describe("Password Length", () => {
      it("accepts password of 8 characters or more", () => {
        expect(validatePassword("password123")).toBeNull();
        expect(validatePassword("12345678")).toBeNull();
      });

      it("rejects password shorter than 8 characters", () => {
        expect(validatePassword("short")).toBe("Password must be at least 8 characters long");
        expect(validatePassword("1234567")).toBe("Password must be at least 8 characters long");
        expect(validatePassword("")).toBe("Password must be at least 8 characters long");
      });
    });

    describe("Sign-Up Validation", () => {
      it("accepts complete and valid signup data", () => {
        const err = validateSignUp({
          fullName: "Jane Doe",
          email: "jane@college.edu",
          password: "securepassword",
        });
        expect(err).toBeNull();
      });

      it("rejects signup with short name", () => {
        const err = validateSignUp({
          fullName: "J",
          email: "jane@college.edu",
          password: "securepassword",
        });
        expect(err).toContain("at least 2 characters");
      });

      it("rejects signup with invalid email", () => {
        const err = validateSignUp({
          fullName: "Jane Doe",
          email: "bademail",
          password: "securepassword",
        });
        expect(err).toBe("Please enter a valid email address");
      });
    });

    describe("Sign-In Validation", () => {
      it("accepts valid credentials", () => {
        expect(validateSignIn({ email: "valid@test.com", password: "pwd" })).toBeNull();
      });

      it("rejects empty password on sign-in", () => {
        expect(validateSignIn({ email: "valid@test.com", password: "" })).toBe(
          "Password is required",
        );
      });
    });
  });

  // ==========================================================================
  // 4. File Upload Validation (MIME & Size)
  // ==========================================================================
  describe("File Upload Validation (Cover Image)", () => {
    it("accepts valid image formats under 5 MB", () => {
      expect(validateCoverImage({ type: "image/jpeg", size: 2 * 1024 * 1024 })).toEqual({
        valid: true,
        extension: "jpg",
      });
      expect(validateCoverImage({ type: "image/png", size: 4 * 1024 * 1024 })).toEqual({
        valid: true,
        extension: "png",
      });
      expect(validateCoverImage({ type: "image/webp", size: MAX_FILE_SIZE_BYTES })).toEqual({
        valid: true,
        extension: "webp",
      });
    });

    it("rejects unsupported MIME types", () => {
      const badTypes = [
        "image/gif",
        "image/svg+xml",
        "application/pdf",
        "application/zip",
        "text/plain",
      ];
      for (const badType of badTypes) {
        const res = validateCoverImage({ type: badType, size: 1024 });
        expect(res.valid).toBe(false);
        expect(res.error).toBe("Use a JPG, PNG or WebP image");
      }
    });

    it("rejects image files exceeding 5 MB", () => {
      const res = validateCoverImage({
        type: "image/jpeg",
        size: MAX_FILE_SIZE_BYTES + 1,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Image must be under 5 MB");
    });
  });

  // ==========================================================================
  // 5. Feedback Validation (Rating 1..5, Comment Length)
  // ==========================================================================
  describe("Feedback Form Validation", () => {
    it("accepts ratings between 1 and 5 with optional comment", () => {
      for (let r = 1; r <= 5; r++) {
        const res = validateFeedback({ rating: r, comment: "Great event!" });
        expect(res.success).toBe(true);
        expect(res.data?.rating).toBe(r);
      }
    });

    it("accepts null or missing comment", () => {
      const res = validateFeedback({ rating: 4, comment: null });
      expect(res.success).toBe(true);
    });

    it("rejects rating of 0", () => {
      const res = validateFeedback({ rating: 0 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Rating must be between 1 and 5");
    });

    it("rejects rating above 5", () => {
      const res = validateFeedback({ rating: 6 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Rating must be between 1 and 5");
    });

    it("rejects non-integer ratings", () => {
      const res = validateFeedback({ rating: 4.5 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("integer");
    });

    it("rejects comments exceeding 2000 characters", () => {
      const longComment = "C".repeat(2001);
      const res = validateFeedback({ rating: 5, comment: longComment });
      expect(res.success).toBe(false);
      expect(res.error).toContain("cannot exceed 2000 characters");
    });

    it("accepts comments up to 2000 characters", () => {
      const exactComment = "C".repeat(2000);
      const res = validateFeedback({ rating: 5, comment: exactComment });
      expect(res.success).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Duplicate Submission & In-Flight Protection
  // ==========================================================================
  describe("Duplicate Submission & Busy Guard Behavior", () => {
    it("blocks second submission while first mutation is in flight", async () => {
      let callCount = 0;
      let inFlight = false;

      async function simulatedSubmitAction() {
        if (inFlight) return { status: "blocked" };
        inFlight = true;
        try {
          await new Promise((r) => setTimeout(r, 20));
          callCount++;
          return { status: "success" };
        } finally {
          inFlight = false;
        }
      }

      // Concurrently trigger 5 submits
      const results = await Promise.all([
        simulatedSubmitAction(),
        simulatedSubmitAction(),
        simulatedSubmitAction(),
        simulatedSubmitAction(),
        simulatedSubmitAction(),
      ]);

      const successes = results.filter((r) => r.status === "success");
      const blocked = results.filter((r) => r.status === "blocked");

      expect(successes).toHaveLength(1);
      expect(blocked).toHaveLength(4);
      expect(callCount).toBe(1);
    });
  });
});
