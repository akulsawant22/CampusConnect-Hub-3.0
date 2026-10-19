// ============================================================================
// Database & Concurrency Simulation Engine
// Simulates PostgreSQL row-level locks, transactions, and SECURITY DEFINER RPCs
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  fullName: string;
}

export type AppRole = "student" | "organizer" | "admin";

export interface UserRoleRecord {
  userId: string;
  role: AppRole;
}

export interface EventRecord {
  id: string;
  organizerId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  capacity: number;
  status: "draft" | "published" | "cancelled" | "completed";
}

export interface RegistrationRecord {
  id: string;
  eventId: string;
  userId: string;
  status: "registered" | "cancelled";
  createdAt: string;
  cancelledAt: string | null;
}

export interface TicketRecord {
  id: string;
  registrationId: string;
  userId: string;
  token: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  checkedInBy: string;
  checkedInAt: string;
}

export interface EventStaffRecord {
  id: string;
  eventId: string;
  userId: string;
  canScan: boolean;
  canViewRegistrations: boolean;
  canViewAttendance: boolean;
}

export interface CertificateRecord {
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
export class Mutex {
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
export class KeyedMutex {
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
export function createMockClient(engine: DatabaseSimulationEngine, userId: string) {
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
