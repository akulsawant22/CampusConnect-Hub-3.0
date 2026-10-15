import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import fs from "node:fs";
import path from "node:path";

describe("Phase G & I: UI, Accessibility & Responsive Quality", () => {
  it("styles.css includes prefers-reduced-motion media query", () => {
    const cssPath = path.resolve(__dirname, "../styles.css");
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain("@media (prefers-reduced-motion: reduce)");
    expect(content).toContain("animation-duration: 0.01ms !important");
    expect(content).toContain("scroll-behavior: auto !important");
  });

  it("EventForm provides explicit htmlFor and id accessible associations for all inputs", () => {
    render(<EventForm onSubmit={() => {}} />);

    // Each label has an associated form control accessible by role/label
    expect(screen.getByLabelText(/^title$/i)).toHaveAttribute("id", "event-title");
    expect(screen.getByLabelText(/^description$/i)).toHaveAttribute("id", "event-desc");
    expect(screen.getByLabelText(/^category$/i)).toHaveAttribute("id", "event-cat");
    expect(screen.getByLabelText(/^venue$/i)).toHaveAttribute("id", "event-venue");
    expect(screen.getByLabelText(/^starts$/i)).toHaveAttribute("id", "event-starts");
    expect(screen.getByLabelText(/^ends$/i)).toHaveAttribute("id", "event-ends");
    expect(screen.getByLabelText(/^registration deadline$/i)).toHaveAttribute(
      "id",
      "event-deadline",
    );
    expect(screen.getByLabelText(/^capacity$/i)).toHaveAttribute("id", "event-capacity");
  });

  it("EventForm displays accessible role='alert' error announcement on validation failure", () => {
    const handleSubmit = vi.fn();
    render(<EventForm onSubmit={handleSubmit} />);

    const titleInput = screen.getByLabelText(/^title$/i);
    fireEvent.change(titleInput, { target: { value: "AB" } }); // Less than min 3 chars

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    // Validation error should trigger role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("EventForm prevents duplicate submissions when busy is true", () => {
    render(<EventForm onSubmit={() => {}} busy={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent(/saving/i);
  });
});
