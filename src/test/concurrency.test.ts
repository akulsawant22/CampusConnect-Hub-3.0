import { describe, expect, it } from "vitest";
import { DatabaseSimulationEngine, createMockClient } from "./simulation-engine";

export { DatabaseSimulationEngine, createMockClient };

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
