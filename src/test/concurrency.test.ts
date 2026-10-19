import { describe, expect, it } from "vitest";

// ============================================================================
// Database & Concurrency Simulation Engine
// Simulates PostgreSQL row-level locks, transactions, and SECURITY DEFINER RPCs
// ============================================================================

interface Profile {
  id: string;
  email: string;
  fullName: string;
}

type AppRole = "student" | "organizer" | "admin";

interface UserRoleRecord {
  userId: string;
  role: AppRole;
}

interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  capacity: number;
  status: "draft" | "published" | "cancelled" | "completed";
}

interface RegistrationRecord {
  id: string;
  eventId: string;
  userId: string;
  status: "registered" | "cancelled";
  createdAt: string;
  cancelledAt: string | null;
}

interface TicketRecord {
  id: string;
  registrationId: string;
  userId: string;
  token: string;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  checkedInBy: string;
  checkedInAt: string;
}

interface EventStaffRecord {
  id: string;
  eventId: string;
  userId: string;
  canScan: boolean;
  canViewRegistrations: boolean;
  canViewAttendance: boolean;
}

interface CertificateRecord {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  issuedBy: string;
  issuedAt: string;
  serial: string;
}

/**
 * Async Mutex implementing FIFO queued mutual exclusion,
 * simulating PostgreSQL's exclusive row-level locking (SELECT ... FOR UPDATE).
 */
class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    if (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.locked = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next();
      } else {
        this.locked = false;
      }
    };
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * KeyedMutex manages discrete locks per row id (e.g. event_id or registration_id).
 */
class KeyedMutex {
  private locks = new Map<string, Mutex>();

  private getLock(key: string): Mutex {
    let m = this.locks.get(key);
    if (!m) {
      m = new Mutex();
      this.locks.set(key, m);
    }
    return m;
  }

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(key);
    return lock.runExclusive(fn);
  }
}

export class DatabaseSimulationEngine {
  public profiles = new Map<string, Profile>();
  public userRoles: UserRoleRecord[] = [];
  public events = new Map<string, EventRecord>();
  public registrations = new Map<string, RegistrationRecord>();
  public tickets = new Map<string, TicketRecord>();
  public attendance = new Map<string, AttendanceRecord>();
  public eventStaff = new Map<string, EventStaffRecord>();
  public certificates = new Map<string, CertificateRecord>();

  // Row-level lock managers
  private eventLocks = new KeyedMutex();
  private registrationLocks = new KeyedMutex();

  public hasRole(userId: string, role: AppRole): boolean {
    return this.userRoles.some((ur) => ur.userId === userId && ur.role === role);
  }

  public canManageEvent(userId: string, eventId: string): boolean {
    if (this.hasRole(userId, "admin")) return true;
    const ev = this.events.get(eventId);
    return ev?.organizerId === userId;
  }

  public staffPerm(
    userId: string,
    eventId: string,
    perm: "scan" | "registrations" | "attendance",
  ): boolean {
    const staff = Array.from(this.eventStaff.values()).find(
      (s) => s.eventId === eventId && s.userId === userId,
    );
    if (!staff) return false;
    if (perm === "scan") return staff.canScan;
    if (perm === "registrations") return staff.canViewRegistrations;
    if (perm === "attendance") return staff.canViewAttendance;
    return false;
  }

  /**
   * Simulates public.register_for_event(_event_id uuid)
   * Acquires exclusive lock on events row FOR UPDATE.
   */
  async registerForEvent(callerUserId: string, eventId: string): Promise<string> {
    if (!callerUserId) throw new Error("Not authenticated");
    if (!this.hasRole(callerUserId, "student")) {
      throw new Error("Only students can register");
    }

    // PostgreSQL: SELECT * FROM public.events WHERE id = _event_id FOR UPDATE
    return this.eventLocks.runExclusive(eventId, async () => {
      // Small randomized delay to simulate genuine async I/O interleaving
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3) + 1));

      const event = this.events.get(eventId);
      if (!event || event.status !== "published") {
        throw new Error("Event not open for registration");
      }
      if (Date.now() > new Date(event.registrationDeadline).getTime()) {
        throw new Error("Registration deadline has passed");
      }

      const existing = Array.from(this.registrations.values()).find(
        (r) => r.eventId === eventId && r.userId === callerUserId,
      );
      if (existing && existing.status === "registered") {
        throw new Error("Already registered");
      }

      const registeredCount = Array.from(this.registrations.values()).filter(
        (r) => r.eventId === eventId && r.status === "registered",
      ).length;

      if (registeredCount >= event.capacity) {
        throw new Error("Event is full");
      }

      if (existing) {
        // Migration 0002 logic: re-activate cancelled registration with a new ticket token
        existing.status = "registered";
        existing.cancelledAt = null;
        const newToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
        const ticket = Array.from(this.tickets.values()).find(
          (t) => t.registrationId === existing.id,
        );
        if (ticket) {
          ticket.token = newToken;
        } else {
          const ticketId = crypto.randomUUID();
          this.tickets.set(ticketId, {
            id: ticketId,
            registrationId: existing.id,
            userId: callerUserId,
            token: newToken,
            createdAt: new Date().toISOString(),
          });
        }
        return existing.id;
      }

      const regId = crypto.randomUUID();
      this.registrations.set(regId, {
        id: regId,
        eventId,
        userId: callerUserId,
        status: "registered",
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      });

      const ticketId = crypto.randomUUID();
      const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      this.tickets.set(ticketId, {
        id: ticketId,
        registrationId: regId,
        userId: callerUserId,
        token,
        createdAt: new Date().toISOString(),
      });

      return regId;
    });
  }

  /**
   * Simulates public.cancel_registration(_registration_id uuid)
   * Locks the registration row to prevent race conditions with check-in.
   */
  async cancelRegistration(callerUserId: string, registrationId: string): Promise<void> {
    if (!callerUserId) throw new Error("Not authenticated");

    return this.registrationLocks.runExclusive(registrationId, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3) + 1));

      const reg = this.registrations.get(registrationId);
      if (!reg || reg.userId !== callerUserId || reg.status !== "registered") {
        throw new Error("Cannot cancel this registration");
      }

      // Check attendance constraint: and not exists (select 1 from public.attendance ...)
      const hasAttended = Array.from(this.attendance.values()).some(
        (a) => a.registrationId === registrationId,
      );
      if (hasAttended) {
        throw new Error("Cannot cancel this registration");
      }

      reg.status = "cancelled";
      reg.cancelledAt = new Date().toISOString();
    });
  }

  /**
   * Simulates public.check_in_ticket(_event_id uuid, _token text)
   * Acquires registration row lock FOR UPDATE (Migration 0008).
   */
  async checkInTicket(
    callerUserId: string,
    eventId: string,
    token: string,
  ): Promise<{
    result: "ok" | "duplicate" | "cancelled" | "wrong_event" | "invalid";
    name?: string;
  }> {
    if (!callerUserId) throw new Error("Not authenticated");
    const canScan =
      this.canManageEvent(callerUserId, eventId) || this.staffPerm(callerUserId, eventId, "scan");
    if (!canScan) throw new Error("Not permitted to scan for this event");

    const ticket = Array.from(this.tickets.values()).find((t) => t.token === token);
    if (!ticket) {
      return { result: "invalid" };
    }

    // Migration 0008 fix: select * into r from public.registrations where id = t.registration_id for update;
    return this.registrationLocks.runExclusive(ticket.registrationId, async () => {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3) + 1));

      const reg = this.registrations.get(ticket.registrationId);
      if (!reg) return { result: "invalid" };

      if (reg.eventId !== eventId) {
        return { result: "wrong_event" };
      }
      if (reg.status !== "registered") {
        return { result: "cancelled" };
      }

      const profile = this.profiles.get(reg.userId);
      const existingAtt = Array.from(this.attendance.values()).find(
        (a) => a.registrationId === reg.id,
      );

      if (existingAtt) {
        return { result: "duplicate", name: profile?.fullName ?? "Student" };
      }

      const attId = crypto.randomUUID();
      this.attendance.set(attId, {
        id: attId,
        registrationId: reg.id,
        eventId: reg.eventId,
        userId: reg.userId,
        checkedInBy: callerUserId,
        checkedInAt: new Date().toISOString(),
      });

      return { result: "ok", name: profile?.fullName ?? "Student" };
    });
  }

  /**
   * Simulates public.issue_certificates(_event_id uuid)
   */
  async issueCertificates(callerUserId: string, eventId: string): Promise<number> {
    if (!callerUserId) throw new Error("Not authenticated");
    if (!this.canManageEvent(callerUserId, eventId)) throw new Error("Not permitted");

    const attendees = Array.from(this.attendance.values()).filter((a) => a.eventId === eventId);
    let count = 0;
    for (const att of attendees) {
      const exists = Array.from(this.certificates.values()).some(
        (c) => c.registrationId === att.registrationId,
      );
      if (!exists) {
        const certId = crypto.randomUUID();
        const serial = crypto.randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase();
        this.certificates.set(certId, {
          id: certId,
          registrationId: att.registrationId,
          eventId,
          userId: att.userId,
          issuedBy: callerUserId,
          issuedAt: new Date().toISOString(),
          serial,
        });
        count++;
      }
    }
    return count;
  }
}

/**
 * Creates a mock Supabase client wrapping the simulation engine for a given user.
 */
function createMockClient(engine: DatabaseSimulationEngine, userId: string) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    rpc: async (
      fnName:
        "register_for_event" | "cancel_registration" | "check_in_ticket" | "issue_certificates",
      params: Record<string, unknown>,
    ) => {
      try {
        if (fnName === "register_for_event") {
          const res = await engine.registerForEvent(userId, params["_event_id"] as string);
          return { data: res, error: null };
        }
        if (fnName === "cancel_registration") {
          await engine.cancelRegistration(userId, params["_registration_id"] as string);
          return { data: null, error: null };
        }
        if (fnName === "check_in_ticket") {
          const res = await engine.checkInTicket(
            userId,
            params["_event_id"] as string,
            params["_token"] as string,
          );
          return { data: res, error: null };
        }
        if (fnName === "issue_certificates") {
          const res = await engine.issueCertificates(userId, params["_event_id"] as string);
          return { data: res, error: null };
        }
        throw new Error(`Unsupported function: ${fnName}`);
      } catch (err) {
        return {
          data: null,
          error: { message: err instanceof Error ? err.message : String(err) },
        };
      }
    },
  };
}

// ============================================================================
// Test Suite: Offline Concurrency & Stress Scenarios
// ============================================================================

describe("Database Concurrency & Stress Scenarios (Offline Simulation)", () => {
  function setupSimulationEnvironment() {
    const engine = new DatabaseSimulationEngine();

    const adminId = "user-admin-1";
    const orgId = "user-org-1";
    const volId = "user-vol-1";

    engine.profiles.set(adminId, {
      id: adminId,
      email: "admin@test.local",
      fullName: "Admin User",
    });
    engine.profiles.set(orgId, { id: orgId, email: "org@test.local", fullName: "Organizer User" });
    engine.profiles.set(volId, { id: volId, email: "vol@test.local", fullName: "Volunteer User" });

    engine.userRoles.push({ userId: adminId, role: "admin" });
    engine.userRoles.push({ userId: orgId, role: "organizer" });
    engine.userRoles.push({ userId: volId, role: "student" });

    // Seed 25 student accounts
    const studentIds: string[] = [];
    for (let i = 1; i <= 25; i++) {
      const sId = `user-student-${i}`;
      studentIds.push(sId);
      engine.profiles.set(sId, {
        id: sId,
        email: `student${i}@test.local`,
        fullName: `Student ${i}`,
      });
      engine.userRoles.push({ userId: sId, role: "student" });
    }

    return { engine, adminId, orgId, volId, studentIds };
  }

  it("20 concurrent registration requests against capacity 5 -> exactly 5 succeed, 15 fail with 'Event is full'", async () => {
    const { engine, orgId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-capacity-5";

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "High Demand Workshop",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 5,
      status: "published",
    });

    // 20 students launch registration requests simultaneously
    const competingStudents = studentIds.slice(0, 20);
    const clients = competingStudents.map((sId) => createMockClient(engine, sId));

    const registrationPromises = clients.map((client) =>
      client.rpc("register_for_event", { _event_id: eventId }),
    );

    const outcomes = await Promise.all(registrationPromises);

    const successfulRegistrations = outcomes.filter((res) => !res.error && res.data);
    const fullErrors = outcomes.filter((res) => res.error?.message.includes("Event is full"));
    const otherErrors = outcomes.filter(
      (res) => res.error && !res.error.message.includes("Event is full"),
    );

    expect(successfulRegistrations).toHaveLength(5);
    expect(fullErrors).toHaveLength(15);
    expect(otherErrors).toHaveLength(0);

    // Verify database state: exactly 5 active registrations, 5 tickets
    const activeDbRegistrations = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.status === "registered",
    );
    expect(activeDbRegistrations).toHaveLength(5);

    const activeDbTickets = Array.from(engine.tickets.values()).filter((t) =>
      activeDbRegistrations.some((r) => r.id === t.registrationId),
    );
    expect(activeDbTickets).toHaveLength(5);
  });

  it("Repeated simultaneous registration requests by the same student -> exactly 1 succeeds", async () => {
    const { engine, orgId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-large-capacity";
    const studentId = studentIds[0]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Concurrent Duplicate Test",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 50,
      status: "published",
    });

    const client = createMockClient(engine, studentId);

    // Same student fires 10 simultaneous registration calls
    const duplicateCalls = Array.from({ length: 10 }, () =>
      client.rpc("register_for_event", { _event_id: eventId }),
    );

    const results = await Promise.all(duplicateCalls);

    const successes = results.filter((r) => !r.error && r.data);
    const alreadyRegisteredErrors = results.filter((r) =>
      r.error?.message.includes("Already registered"),
    );

    expect(successes).toHaveLength(1);
    expect(alreadyRegisteredErrors).toHaveLength(9);

    // Exactly 1 registration row and 1 ticket row exists in DB for this student
    const studentRegistrations = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.userId === studentId && r.status === "registered",
    );
    expect(studentRegistrations).toHaveLength(1);

    const studentTickets = Array.from(engine.tickets.values()).filter(
      (t) => t.userId === studentId,
    );
    expect(studentTickets).toHaveLength(1);
  });

  it("Concurrent ticket check-in scans -> exactly 1 returns 'ok', subsequent/concurrent return 'duplicate'", async () => {
    const { engine, orgId, volId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-check-in-test";
    const studentId = studentIds[0]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Check-in Stress Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });

    // Assign volunteer with scan permission
    engine.eventStaff.set(`staff-1`, {
      id: `staff-1`,
      eventId,
      userId: volId,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    // Student registers and gets a ticket
    const studentClient = createMockClient(engine, studentId);
    const regRes = await studentClient.rpc("register_for_event", { _event_id: eventId });
    expect(regRes.error).toBeNull();

    const ticket = Array.from(engine.tickets.values()).find((t) => t.userId === studentId)!;
    expect(ticket).toBeDefined();

    const volClient = createMockClient(engine, volId);
    const orgClient = createMockClient(engine, orgId);

    // 12 simultaneous check-in attempts from volunteer and organizer scanners
    const simultaneousScans = Array.from({ length: 12 }, (_, i) =>
      (i % 2 === 0 ? volClient : orgClient).rpc("check_in_ticket", {
        _event_id: eventId,
        _token: ticket.token,
      }),
    );

    const scanResults = await Promise.all(simultaneousScans);

    const outcomes = scanResults.map((r) => r.data as { result: string; name?: string });

    const okCount = outcomes.filter((o) => o?.result === "ok").length;
    const duplicateCount = outcomes.filter((o) => o?.result === "duplicate").length;

    expect(okCount).toBe(1);
    expect(duplicateCount).toBe(11);

    // Database check: exactly 1 attendance record exists
    const attendanceRecords = Array.from(engine.attendance.values()).filter(
      (a) => a.eventId === eventId && a.registrationId === regRes.data,
    );
    expect(attendanceRecords).toHaveLength(1);
    expect(attendanceRecords[0]!.userId).toBe(studentId);
  });

  it("Cancelled registration ticket check-in -> returns 'cancelled'", async () => {
    const { engine, orgId, volId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-cancel-test";
    const studentId = studentIds[1]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Cancellation Flow Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });

    engine.eventStaff.set(`staff-2`, {
      id: `staff-2`,
      eventId,
      userId: volId,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    const studentClient = createMockClient(engine, studentId);
    const regRes = await studentClient.rpc("register_for_event", { _event_id: eventId });
    expect(regRes.error).toBeNull();
    const regId = regRes.data as string;

    const ticket = Array.from(engine.tickets.values()).find((t) => t.registrationId === regId)!;
    expect(ticket).toBeDefined();

    // Student cancels their registration
    const cancelRes = await studentClient.rpc("cancel_registration", { _registration_id: regId });
    expect(cancelRes.error).toBeNull();

    // Check DB status is 'cancelled'
    const dbReg = engine.registrations.get(regId);
    expect(dbReg?.status).toBe("cancelled");
    expect(dbReg?.cancelledAt).not.toBeNull();

    // Volunteer attempts to check in the ticket with that token
    const volClient = createMockClient(engine, volId);
    const scanRes = await volClient.rpc("check_in_ticket", {
      _event_id: eventId,
      _token: ticket.token,
    });

    expect(scanRes.error).toBeNull();
    expect((scanRes.data as { result: string })?.result).toBe("cancelled");

    // Ensure no attendance record was created
    const att = Array.from(engine.attendance.values()).find((a) => a.registrationId === regId);
    expect(att).toBeUndefined();
  });

  it("Registration row lock eliminates check_in vs cancel_registration race condition", async () => {
    const { engine, orgId, volId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-race-test";
    const studentId = studentIds[2]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Race Condition Test",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 5,
      status: "published",
    });

    engine.eventStaff.set(`staff-race`, {
      id: `staff-race`,
      eventId,
      userId: volId,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    const studentClient = createMockClient(engine, studentId);
    const regRes = await studentClient.rpc("register_for_event", { _event_id: eventId });
    const regId = regRes.data!;
    const ticket = Array.from(engine.tickets.values()).find((t) => t.registrationId === regId)!;

    const volClient = createMockClient(engine, volId);

    // Concurrently trigger check_in_ticket and cancel_registration
    const [scanOutcome, cancelOutcome] = await Promise.all([
      volClient.rpc("check_in_ticket", { _event_id: eventId, _token: ticket.token }),
      studentClient.rpc("cancel_registration", { _registration_id: regId }),
    ]);

    // Due to the registration row lock FOR UPDATE:
    // Case 1: Check-in executed first -> scan succeeds (ok), cancel fails (Cannot cancel, attendance exists)
    // Case 2: Cancellation executed first -> cancel succeeds, scan returns 'cancelled'
    // In NEITHER case should both succeed simultaneously!
    const scanResult = (scanOutcome.data as { result: string } | null)?.result;
    const cancelSucceeded = !cancelOutcome.error;

    if (scanResult === "ok") {
      expect(cancelSucceeded).toBe(false);
      expect(cancelOutcome.error?.message).toContain("Cannot cancel");
    } else {
      expect(scanResult).toBe("cancelled");
      expect(cancelSucceeded).toBe(true);
    }
  });

  it("Re-registering after cancellation rotates token and permits renewed check-in", async () => {
    const { engine, orgId, volId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-re-reg-test";
    const studentId = studentIds[3]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Re-registration Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 1, // capacity of 1 to strictly test seat release
      status: "published",
    });

    engine.eventStaff.set(`staff-re-reg`, {
      id: `staff-re-reg`,
      eventId,
      userId: volId,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    const studentClient = createMockClient(engine, studentId);
    const volClient = createMockClient(engine, volId);

    // 1. First registration
    const regRes1 = await studentClient.rpc("register_for_event", { _event_id: eventId });
    expect(regRes1.error).toBeNull();
    const originalToken = Array.from(engine.tickets.values()).find(
      (t) => t.registrationId === regRes1.data,
    )!.token;

    // 2. Cancellation releases the seat
    await studentClient.rpc("cancel_registration", { _registration_id: regRes1.data! });

    // 3. Re-registration succeeds because seat was released
    const regRes2 = await studentClient.rpc("register_for_event", { _event_id: eventId });
    expect(regRes2.error).toBeNull();

    const refreshedTicket = Array.from(engine.tickets.values()).find(
      (t) => t.registrationId === regRes1.data,
    )!;
    expect(refreshedTicket.token).not.toBe(originalToken); // Fresh rotated token

    // 4. Scanning the OLD token is rejected
    const oldScan = await volClient.rpc("check_in_ticket", {
      _event_id: eventId,
      _token: originalToken,
    });
    expect((oldScan.data as { result: string })?.result).toBe("invalid");

    // 5. Scanning the NEW token succeeds
    const newScan = await volClient.rpc("check_in_ticket", {
      _event_id: eventId,
      _token: refreshedTicket.token,
    });
    expect((newScan.data as { result: string })?.result).toBe("ok");
  });

  it("Capacity of 1 boundary condition: 10 competing students -> exactly 1 succeeds, 9 fail with 'Event is full'", async () => {
    const { engine, orgId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-capacity-1";

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Solo Workshop",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 1,
      status: "published",
    });

    const competingStudents = studentIds.slice(0, 10);
    const clients = competingStudents.map((sId) => createMockClient(engine, sId));

    const registrationPromises = clients.map((client) =>
      client.rpc("register_for_event", { _event_id: eventId }),
    );

    const outcomes = await Promise.all(registrationPromises);

    const successfulRegistrations = outcomes.filter((res) => !res.error && res.data);
    const fullErrors = outcomes.filter((res) => res.error?.message.includes("Event is full"));

    expect(successfulRegistrations).toHaveLength(1);
    expect(fullErrors).toHaveLength(9);

    const activeDbRegistrations = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.status === "registered",
    );
    expect(activeDbRegistrations).toHaveLength(1);
  });

  it("Concurrent cancellation and registration race: seat released and claimed without invariant violation", async () => {
    const { engine, orgId, studentIds } = setupSimulationEnvironment();
    const eventId = "event-cancel-race";
    const initialStudentId = studentIds[0]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Hot Seat Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 1,
      status: "published",
    });

    // Student 1 registers first
    const client1 = createMockClient(engine, initialStudentId);
    const regRes1 = await client1.rpc("register_for_event", { _event_id: eventId });
    expect(regRes1.error).toBeNull();
    const reg1Id = regRes1.data as string;

    // Concurrently: Student 1 cancels, while Students 2, 3, 4 race to register
    const competingClients = [
      createMockClient(engine, studentIds[1]!),
      createMockClient(engine, studentIds[2]!),
      createMockClient(engine, studentIds[3]!),
    ];

    const [cancelOutcome, ...registerOutcomes] = await Promise.all([
      client1.rpc("cancel_registration", { _registration_id: reg1Id }),
      ...competingClients.map((c) => c.rpc("register_for_event", { _event_id: eventId })),
    ]);

    expect(cancelOutcome.error).toBeNull();

    // Out of the 3 competing students, at least 1 must have obtained the seat if they evaluated after cancellation,
    // and under no circumstance should more than 1 have registered!
    const successfulClaims = registerOutcomes.filter((r) => !r.error && r.data);
    const fullRejections = registerOutcomes.filter((r) =>
      r.error?.message.includes("Event is full"),
    );

    expect(successfulClaims.length).toBeLessThanOrEqual(1);
    expect(successfulClaims.length + fullRejections.length).toBe(3);

    // Active registered seats in DB must be exactly the number of successful claims (<= 1)
    const activeDbRegistrations = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.status === "registered",
    );
    expect(activeDbRegistrations.length).toBe(successfulClaims.length);
  });

  it("Registration validation: deadline passed, non-published statuses, and role authorization strictly enforced", async () => {
    const { engine, orgId, adminId, studentIds } = setupSimulationEnvironment();
    const studentId = studentIds[4]!;
    const studentClient = createMockClient(engine, studentId);

    // 1. Expired deadline
    const expiredEventId = "event-expired";
    engine.events.set(expiredEventId, {
      id: expiredEventId,
      organizerId: orgId,
      title: "Expired Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      capacity: 10,
      status: "published",
    });
    const expiredRes = await studentClient.rpc("register_for_event", { _event_id: expiredEventId });
    expect(expiredRes.error?.message).toContain("Registration deadline has passed");

    // 2. Draft / Cancelled status
    const draftEventId = "event-draft";
    engine.events.set(draftEventId, {
      id: draftEventId,
      organizerId: orgId,
      title: "Draft Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "draft",
    });
    const draftRes = await studentClient.rpc("register_for_event", { _event_id: draftEventId });
    expect(draftRes.error?.message).toContain("Event not open for registration");

    // 3. Non-student caller (e.g. admin or organizer who does not have student role)
    const adminClient = createMockClient(engine, adminId);
    const validEventId = "event-valid";
    engine.events.set(validEventId, {
      id: validEventId,
      organizerId: orgId,
      title: "Open Event",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });
    const nonStudentRes = await adminClient.rpc("register_for_event", { _event_id: validEventId });
    expect(nonStudentRes.error?.message).toContain("Only students can register");
  });
});
