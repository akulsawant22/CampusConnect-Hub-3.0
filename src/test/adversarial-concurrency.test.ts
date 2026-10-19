import { describe, expect, it } from "vitest";
import { DatabaseSimulationEngine } from "./simulation-engine";

// ============================================================================
// Adversarial Concurrency & Stress Testing Suite
// Rigorous verification of PostgreSQL row locking, race conditions, and invariants
// ============================================================================

interface StressMetrics {
  totalRequests: number;
  successful: number;
  rejected: number;
  unexpectedErrors: number;
  totalDurationMs: number;
  latenciesMs: number[];
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
}

function calculateMetrics(
  latencies: number[],
  successful: number,
  rejected: number,
  unexpectedErrors: number,
  totalDurationMs: number,
): StressMetrics {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = latencies.length;
  const p50 = sorted[Math.floor(total * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(total * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(total * 0.99)] ?? 0;
  const avg = total > 0 ? latencies.reduce((a, b) => a + b, 0) / total : 0;
  return {
    totalRequests: total,
    successful,
    rejected,
    unexpectedErrors,
    totalDurationMs,
    latenciesMs: sorted,
    p50Ms: Number(p50.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    p99Ms: Number(p99.toFixed(2)),
    avgLatencyMs: Number(avg.toFixed(2)),
    maxLatencyMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    minLatencyMs: Number((sorted[0] ?? 0).toFixed(2)),
  };
}

describe("Adversarial Concurrency Stress Harness", () => {
  function setupStressEnvironment(studentCount = 120) {
    const engine = new DatabaseSimulationEngine();

    const adminId = "stress-admin-1";
    const orgId = "stress-org-1";
    const volId1 = "stress-vol-1";
    const volId2 = "stress-vol-2";

    engine.profiles.set(adminId, {
      id: adminId,
      email: "admin@stress.local",
      fullName: "Admin Officer",
    });
    engine.profiles.set(orgId, {
      id: orgId,
      email: "organizer@stress.local",
      fullName: "Lead Organizer",
    });
    engine.profiles.set(volId1, {
      id: volId1,
      email: "vol1@stress.local",
      fullName: "Gate Volunteer 1",
    });
    engine.profiles.set(volId2, {
      id: volId2,
      email: "vol2@stress.local",
      fullName: "Gate Volunteer 2",
    });

    engine.userRoles.push({ userId: adminId, role: "admin" });
    engine.userRoles.push({ userId: orgId, role: "organizer" });
    engine.userRoles.push({ userId: volId1, role: "student" });
    engine.userRoles.push({ userId: volId2, role: "student" });

    const studentIds: string[] = [];
    for (let i = 1; i <= studentCount; i++) {
      const sId = `stress-student-${i}`;
      studentIds.push(sId);
      engine.profiles.set(sId, {
        id: sId,
        email: `student${i}@stress.local`,
        fullName: `Candidate Student ${i}`,
      });
      engine.userRoles.push({ userId: sId, role: "student" });
    }

    return { engine, adminId, orgId, volId1, volId2, studentIds };
  }

  // ==========================================================================
  // Dimension 1: 100 Simultaneous Registration Requests for Capacity 3
  // ==========================================================================
  it("Adversarial Test 1: 100 simultaneous registration requests for an event with capacity 3 -> exactly 3 succeed, 97 rejected, zero overbooking", async () => {
    const { engine, orgId, studentIds } = setupStressEnvironment(100);
    const eventId = "stress-event-cap-3";

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Exclusive Robotics Lab Session",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 3,
      status: "published",
    });

    const latencies: number[] = [];
    const testStartTime = performance.now();

    // 100 distinct students simultaneously invoke register_for_event
    const registrationTasks = studentIds.map(async (studentId) => {
      const start = performance.now();
      try {
        const regId = await engine.registerForEvent(studentId, eventId);
        const duration = performance.now() - start;
        latencies.push(duration);
        return { success: true, regId, studentId, error: null };
      } catch (err) {
        const duration = performance.now() - start;
        latencies.push(duration);
        return {
          success: false,
          regId: null,
          studentId,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const results = await Promise.all(registrationTasks);
    const totalDurationMs = performance.now() - testStartTime;

    const successes = results.filter((r) => r.success);
    const capacityRejections = results.filter((r) => r.error?.includes("Event is full"));
    const unexpectedErrors = results.filter(
      (r) => !r.success && !r.error?.includes("Event is full"),
    );

    const metrics = calculateMetrics(
      latencies,
      successes.length,
      capacityRejections.length,
      unexpectedErrors.length,
      totalDurationMs,
    );

    console.log("[METRICS - Test 1: 100 Simultaneous Requests on Cap 3]:", {
      totalRequests: metrics.totalRequests,
      successful: metrics.successful,
      capacityRejections: metrics.rejected,
      unexpectedErrors: metrics.unexpectedErrors,
      totalDurationMs: metrics.totalDurationMs.toFixed(2),
      avgLatencyMs: metrics.avgLatencyMs,
      p50Ms: metrics.p50Ms,
      p95Ms: metrics.p95Ms,
      p99Ms: metrics.p99Ms,
    });

    // Invariant 1: Exactly capacity (3) registrations succeed
    expect(successes).toHaveLength(3);

    // Invariant 2: Exactly 97 rejected with 'Event is full'
    expect(capacityRejections).toHaveLength(97);
    expect(unexpectedErrors).toHaveLength(0);

    // Invariant 3: Database state strictly matches capacity
    const activeRegistrations = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.status === "registered",
    );
    expect(activeRegistrations).toHaveLength(3);

    // Invariant 4: Each confirmed registration has exactly 1 valid ticket
    const tickets = Array.from(engine.tickets.values()).filter((t) =>
      activeRegistrations.some((r) => r.id === t.registrationId),
    );
    expect(tickets).toHaveLength(3);

    // Invariant 5: Each ticket token is unique and non-empty
    const tokens = new Set(tickets.map((t) => t.token));
    expect(tokens.size).toBe(3);
  });

  // ==========================================================================
  // Dimension 2: Extreme Boundary: Capacity 1 with Rapid Interleaved Cancellations & Registrations
  // ==========================================================================
  it("Adversarial Test 2: Extreme boundary conditions: event with capacity 1, rapid interleaved cancellations and registrations", async () => {
    const { engine, orgId, studentIds } = setupStressEnvironment(30);
    const eventId = "stress-event-cap-1";

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "1-on-1 Mentorship Slot",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 1,
      status: "published",
    });

    // Student 1 registers initially
    const regId1 = await engine.registerForEvent(studentIds[0]!, eventId);
    expect(regId1).toBeDefined();

    let currentOccupantRegId = regId1;
    let currentOccupantStudentId = studentIds[0]!;

    // Execute 25 rounds of interleaved cancellation and concurrent registrations
    for (let round = 1; round <= 25; round++) {
      // Pick 5 candidate students for this round
      const candidateStudents = [
        studentIds[(round * 2) % 30]!,
        studentIds[(round * 2 + 1) % 30]!,
        studentIds[(round * 2 + 2) % 30]!,
        currentOccupantStudentId, // The occupant may attempt re-registration or concurrent action
      ];

      // Concurrently fire cancellation of the current occupant AND registration attempts from candidates
      const cancelPromise = engine
        .cancelRegistration(currentOccupantStudentId, currentOccupantRegId)
        .then(() => ({ op: "cancel", success: true, error: null }))
        .catch((err) => ({
          op: "cancel",
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }));

      const regPromises = candidateStudents.map(async (sId) => {
        try {
          const newRegId = await engine.registerForEvent(sId, eventId);
          return { op: "register", studentId: sId, regId: newRegId, success: true, error: null };
        } catch (err) {
          return {
            op: "register",
            studentId: sId,
            regId: null,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      const [cancelRes, ...regResults] = await Promise.all([cancelPromise, ...regPromises]);

      // INVARIANT CHECK: In the database, the number of active registered users for this event
      // must NEVER exceed 1 at ANY round!
      const activeRegistrations = Array.from(engine.registrations.values()).filter(
        (r) => r.eventId === eventId && r.status === "registered",
      );
      expect(activeRegistrations.length).toBeLessThanOrEqual(1);

      const successfulClaims = regResults.filter((r) => r.success);
      expect(successfulClaims.length).toBeLessThanOrEqual(1);

      if (successfulClaims.length === 1) {
        currentOccupantRegId = successfulClaims[0]!.regId!;
        currentOccupantStudentId = successfulClaims[0]!.studentId;
      } else if (cancelRes.success) {
        // Seat is vacant, fill it for the next round
        const fallbackStudent = studentIds[(round + 5) % 30]!;
        currentOccupantRegId = await engine.registerForEvent(fallbackStudent, eventId);
        currentOccupantStudentId = fallbackStudent;
      }
    }

    // Final verification of DB state: strictly <= 1 active registration
    const finalActive = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventId && r.status === "registered",
    );
    expect(finalActive.length).toBe(1);

    // Verify token rotation on re-registration:
    // If the final occupant cancels and re-registers, their ticket token MUST change
    const priorTicket = Array.from(engine.tickets.values()).find(
      (t) => t.registrationId === currentOccupantRegId,
    )!;
    const priorToken = priorTicket.token;

    await engine.cancelRegistration(currentOccupantStudentId, currentOccupantRegId);
    const reRegId = await engine.registerForEvent(currentOccupantStudentId, eventId);
    expect(reRegId).toBe(currentOccupantRegId);

    const refreshedTicket = Array.from(engine.tickets.values()).find(
      (t) => t.registrationId === currentOccupantRegId,
    )!;
    expect(refreshedTicket.token).not.toBe(priorToken);
  }, 30000);

  // ==========================================================================
  // Dimension 3: Multi-Event Concurrency: Row Locks on Event A do NOT block Event B
  // ==========================================================================
  it("Adversarial Test 3: Multi-event concurrency: simultaneous registrations across multiple distinct events verify row locks on event A do not serialize or block registrations on event B", async () => {
    const { engine, orgId, studentIds } = setupStressEnvironment(60);

    const eventA = "event-stream-alpha";
    const eventB = "event-stream-beta";

    engine.events.set(eventA, {
      id: eventA,
      organizerId: orgId,
      title: "Stream Alpha: AI Keynote",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });

    engine.events.set(eventB, {
      id: eventB,
      organizerId: orgId,
      title: "Stream Beta: Web3 Workshop",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });

    const studentsForA = studentIds.slice(0, 25); // 25 competing for 10 seats
    const studentsForB = studentIds.slice(25, 50); // 25 competing for 10 seats

    const eventATimestamps: { start: number; end: number }[] = [];
    const eventBTimestamps: { start: number; end: number }[] = [];

    const overallStart = performance.now();

    // Simultaneously fire all 50 registration calls across both events
    const promisesA = studentsForA.map(async (sId) => {
      const start = performance.now();
      try {
        await engine.registerForEvent(sId, eventA);
        eventATimestamps.push({ start, end: performance.now() });
      } catch {
        eventATimestamps.push({ start, end: performance.now() });
      }
    });

    const promisesB = studentsForB.map(async (sId) => {
      const start = performance.now();
      try {
        await engine.registerForEvent(sId, eventB);
        eventBTimestamps.push({ start, end: performance.now() });
      } catch {
        eventBTimestamps.push({ start, end: performance.now() });
      }
    });

    await Promise.all([...promisesA, ...promisesB]);
    const overallDuration = performance.now() - overallStart;

    // Both events should have exactly 10 registered attendees
    const activeA = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventA && r.status === "registered",
    );
    const activeB = Array.from(engine.registrations.values()).filter(
      (r) => r.eventId === eventB && r.status === "registered",
    );

    expect(activeA).toHaveLength(10);
    expect(activeB).toHaveLength(10);

    // Verify concurrency overlap:
    // Some registrations on Event B must have executed in parallel with Event A
    // (i.e. Event B's execution time overlaps with Event A's execution intervals)
    const minStartA = Math.min(...eventATimestamps.map((t) => t.start));
    const maxEndA = Math.max(...eventATimestamps.map((t) => t.end));

    const overlappingB = eventBTimestamps.filter((t) => t.start >= minStartA && t.end <= maxEndA);

    console.log("[METRICS - Test 3: Multi-Event Lock Granularity]:", {
      overallDurationMs: overallDuration.toFixed(2),
      eventARequests: eventATimestamps.length,
      eventBRequests: eventBTimestamps.length,
      overlappingEventBRequests: overlappingB.length,
    });

    // Substantial number of Event B operations ran concurrently during Event A processing
    expect(overlappingB.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Dimension 4: Ticket Check-in Under High Concurrency: Zero Duplicate Check-ins
  // ==========================================================================
  it("Adversarial Test 4: Ticket check-in under high concurrency: 100 simultaneous scans verify no duplicate check-ins are EVER created", async () => {
    const { engine, orgId, volId1, volId2, studentIds } = setupStressEnvironment(10);
    const eventId = "stress-event-checkin";
    const studentId = studentIds[0]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Grand Hackathon Opening",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 50,
      status: "published",
    });

    // Assign volunteer permissions to scan
    engine.eventStaff.set("staff-vol1", {
      id: "staff-vol1",
      eventId,
      userId: volId1,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });
    engine.eventStaff.set("staff-vol2", {
      id: "staff-vol2",
      eventId,
      userId: volId2,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    // Student registers and obtains ticket
    const regId = await engine.registerForEvent(studentId, eventId);
    const ticket = Array.from(engine.tickets.values()).find((t) => t.registrationId === regId)!;
    expect(ticket).toBeDefined();

    // 100 simultaneous check-in attempts from 3 distinct scanners: orgId, volId1, volId2
    const scanners = [orgId, volId1, volId2];
    const scanLatencies: number[] = [];
    const scanStartTime = performance.now();

    const checkInTasks = Array.from({ length: 100 }, async (_, index) => {
      const scanner = scanners[index % scanners.length]!;
      const start = performance.now();
      try {
        const res = await engine.checkInTicket(scanner, eventId, ticket.token);
        scanLatencies.push(performance.now() - start);
        return { success: true, result: res.result, error: null };
      } catch (err) {
        scanLatencies.push(performance.now() - start);
        return {
          success: false,
          result: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const scanResults = await Promise.all(checkInTasks);
    const totalScanDurationMs = performance.now() - scanStartTime;

    const okScans = scanResults.filter((r) => r.result === "ok");
    const duplicateScans = scanResults.filter((r) => r.result === "duplicate");
    const errors = scanResults.filter(
      (r) => !r.success || !["ok", "duplicate"].includes(r.result!),
    );

    const metrics = calculateMetrics(
      scanLatencies,
      okScans.length,
      duplicateScans.length,
      errors.length,
      totalScanDurationMs,
    );

    console.log("[METRICS - Test 4: 100 Concurrent Check-in Scans]:", {
      totalScans: metrics.totalRequests,
      okScans: metrics.successful,
      duplicateScans: metrics.rejected,
      errors: metrics.unexpectedErrors,
      totalDurationMs: metrics.totalDurationMs.toFixed(2),
      avgLatencyMs: metrics.avgLatencyMs,
      p50Ms: metrics.p50Ms,
      p95Ms: metrics.p95Ms,
      p99Ms: metrics.p99Ms,
    });

    // Invariant 1: EXACTLY 1 scan returns 'ok'
    expect(okScans).toHaveLength(1);

    // Invariant 2: EXACTLY 99 scans return 'duplicate'
    expect(duplicateScans).toHaveLength(99);
    expect(errors).toHaveLength(0);

    // Invariant 3: EXACTLY 1 attendance row created in the database
    const attendanceRecords = Array.from(engine.attendance.values()).filter(
      (a) => a.eventId === eventId && a.registrationId === regId,
    );
    expect(attendanceRecords).toHaveLength(1);
    expect(attendanceRecords[0]!.userId).toBe(studentId);

    // Part B: Simultaneous check-in on 5 distinct tickets (20 scans each = 100 total scans)
    const multiTicketRegs: { studentId: string; regId: string; token: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const sId = studentIds[i]!;
      const rId = await engine.registerForEvent(sId, eventId);
      const tk = Array.from(engine.tickets.values()).find((t) => t.registrationId === rId)!;
      multiTicketRegs.push({ studentId: sId, regId: rId, token: tk.token });
    }

    const multiScanTasks = multiTicketRegs.flatMap((tInfo) =>
      Array.from({ length: 20 }, (_, idx) => {
        const scanner = scanners[idx % scanners.length]!;
        return engine.checkInTicket(scanner, eventId, tInfo.token);
      }),
    );

    const multiScanResults = await Promise.all(multiScanTasks);
    const multiOk = multiScanResults.filter((r) => r.result === "ok");
    const multiDup = multiScanResults.filter((r) => r.result === "duplicate");

    // Exactly 5 'ok' (one per ticket), exactly 95 duplicates
    expect(multiOk).toHaveLength(5);
    expect(multiDup).toHaveLength(95);

    // Total attendance for all 6 attendees in event
    const totalAttendance = Array.from(engine.attendance.values()).filter(
      (a) => a.eventId === eventId,
    );
    expect(totalAttendance).toHaveLength(6);
  });

  // ==========================================================================
  // Dimension 5: High Concurrency Collision: 50 Scans vs 1 Cancellation
  // ==========================================================================
  it("Adversarial Test 5: Collision: 50 concurrent check-in scans racing against 1 cancellation request", async () => {
    const { engine, orgId, volId1, studentIds } = setupStressEnvironment(5);
    const eventId = "stress-event-collision";
    const studentId = studentIds[0]!;

    engine.events.set(eventId, {
      id: eventId,
      organizerId: orgId,
      title: "Flash Collision Workshop",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
      capacity: 10,
      status: "published",
    });

    engine.eventStaff.set("staff-collision", {
      id: "staff-collision",
      eventId,
      userId: volId1,
      canScan: true,
      canViewRegistrations: false,
      canViewAttendance: true,
    });

    const regId = await engine.registerForEvent(studentId, eventId);
    const ticket = Array.from(engine.tickets.values()).find((t) => t.registrationId === regId)!;

    // Concurrently trigger 50 check-in calls and 1 cancel call
    const cancelPromise = engine
      .cancelRegistration(studentId, regId)
      .then(() => ({ success: true, error: null }))
      .catch((err) => ({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }));

    const scanPromises = Array.from({ length: 50 }, () =>
      engine.checkInTicket(volId1, eventId, ticket.token),
    );

    const [cancelOutcome, ...scanOutcomes] = await Promise.all([cancelPromise, ...scanPromises]);

    const okCount = scanOutcomes.filter((r) => r.result === "ok").length;
    const cancelledCount = scanOutcomes.filter((r) => r.result === "cancelled").length;
    const duplicateCount = scanOutcomes.filter((r) => r.result === "duplicate").length;

    console.log("[METRICS - Test 5: Check-in vs Cancellation Collision]:", {
      cancelSucceeded: cancelOutcome.success,
      okCount,
      duplicateCount,
      cancelledCount,
    });

    if (cancelOutcome.success) {
      // Cancellation committed before any check-in acquired registration lock
      // All scans must see status 'cancelled'
      expect(okCount).toBe(0);
      expect(cancelledCount).toBe(50);
      const att = Array.from(engine.attendance.values()).filter((a) => a.registrationId === regId);
      expect(att).toHaveLength(0);
    } else {
      // Check-in committed first and locked registration row
      // Cancellation must be rejected with 'Cannot cancel this registration'
      expect(cancelOutcome.error).toContain("Cannot cancel this registration");
      expect(okCount).toBe(1);
      expect(duplicateCount).toBe(49);
      const att = Array.from(engine.attendance.values()).filter((a) => a.registrationId === regId);
      expect(att).toHaveLength(1);
    }
  });
});
