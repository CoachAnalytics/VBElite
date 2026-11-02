import { describe, expect, it } from "vitest";
import { coachEmail, greetingName, mailtoLink, mergeContacts, onSchoolDomain } from "./coachEmail";

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

describe("coachEmail with stats", () => {
  it("adds her latest season and MaxPreps page when she has them", () => {
    const { body } = coachEmail({ ...athlete, statsLine: "2025-26 varsity (So): 312 kills (3.25/set)", maxprepsUrl: "https://www.maxpreps.com/x/athletes/y/" }, "Sample U", "Pat Lee");
    expect(body).toContain("Stats: 2025-26 varsity (So): 312 kills (3.25/set)");
    expect(body).toContain("MaxPreps: https://www.maxpreps.com/x/athletes/y/");
    expect(coachEmail(athlete, "Sample U", "Pat Lee").body).not.toContain("MaxPreps:");
  });
});

describe("mailtoLink", () => {
  it("encodes subject and body, keeping line breaks", () => {
    const link = mailtoLink("coach@school.edu", "A & B", "Hi,\nThanks");
    expect(link).toBe("mailto:coach@school.edu?subject=A%20%26%20B&body=Hi%2C%0AThanks");
  });
});


describe("onSchoolDomain", () => {
  it("accepts the school's and its athletics site's domains, including subdomains", () => {
    const sites = ["www.udayton.edu", "daytonflyers.com"];
    expect(onSchoolDomain("coach@udayton.edu", sites)).toBe(true);
    expect(onSchoolDomain("coach@mail.udayton.edu", sites)).toBe(true);
    expect(onSchoolDomain("coach@daytonflyers.com", sites)).toBe(true);
    expect(onSchoolDomain("coach@gmail.com", sites)).toBe(false);
  });
});

describe("mergeContacts", () => {
  const official = [
    { id: 1, name: "Pat Lee", title: "Head Coach", role: "head", email: null, phone: null },
    { id: 2, name: "Sam Roe", title: "Assistant Coach", role: "assistant", email: "sroe@school.edu", phone: null },
  ];
  it("fills a listed coach's missing email and adds new people", () => {
    const out = mergeContacts(official, [
      { id: 7, name: "Pat Lee", title: null, role: "head", email: "plee@school.edu", status: "approved", mine: false },
      { id: 8, name: "Jo Day", title: "Assistant Coach", role: "recruiting", email: "jday@school.edu", status: "approved", mine: false },
    ]);
    expect(out.map((c) => [c.name, c.email, c.added])).toEqual([
      ["Pat Lee", "plee@school.edu", "approved"],
      ["Jo Day", "jday@school.edu", "approved"],
      ["Sam Roe", "sroe@school.edu", undefined],
    ]);
  });
  it("shows pending emails only to the family that added them, and skips duplicates", () => {
    const pending = { id: 9, name: "New Coach", title: null, role: "assistant", email: "new@school.edu", status: "pending" };
    expect(mergeContacts(official, [{ ...pending, mine: false }])).toHaveLength(2);
    expect(mergeContacts(official, [{ ...pending, mine: true }]).at(-1)?.added).toBe("mine");
    expect(mergeContacts(official, [{ ...pending, email: "SROE@school.edu", mine: true }])).toHaveLength(2);
  });
});
