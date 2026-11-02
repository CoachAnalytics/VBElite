import { describe, expect, it } from "vitest";
import { coachEmail, greetingName, mailtoLink } from "./coachEmail";

const athlete = { name: "Test Athlete", gradYear: 2030, position: "OH", heightIn: 70, homeCity: "Columbus", homeState: "OH", video: "" };

describe("greetingName", () => {
  it("uses the last name, ignoring credentials", () => {
    expect(greetingName("Pat Lee")).toBe("Coach Lee");
    expect(greetingName("Mark Smith, MS, CSCS")).toBe("Coach Smith");
    expect(greetingName(null)).toBe("Coach");
  });
});

describe("coachEmail", () => {
  it("introduces the athlete with class, position, height and hometown", () => {
    const { subject, body } = coachEmail(athlete, "Sample U", "Pat Lee");
    expect(subject).toBe(`Test Athlete | Class of 2030 Outside hitter | 5'10"`);
    expect(body).toMatch(/^Hi Coach Lee,/);
    expect(body).toContain(`a Class of 2030 outside hitter (5'10") from Columbus, OH`);
    expect(body).toContain("interested in Sample U volleyball");
    expect(body).toContain("Highlight video: [add link]");
  });

  it("includes her video link when she has one", () => {
    expect(coachEmail({ ...athlete, video: "https://example.com/v" }, "Sample U", null).body).toContain("Highlight video: https://example.com/v");
  });
});

describe("mailtoLink", () => {
  it("encodes subject and body, keeping line breaks", () => {
    const link = mailtoLink("coach@school.edu", "A & B", "Hi,\nThanks");
    expect(link).toBe("mailto:coach@school.edu?subject=A%20%26%20B&body=Hi%2C%0AThanks");
  });
});
