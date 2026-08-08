import { describe, expect, it } from "vitest";
import { projectMembershipWhere, roleAtLeast } from "./project-access";

describe("roleAtLeast", () => {
  it("orders VIEWER < ADMIN < OWNER", () => {
    expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
    expect(roleAtLeast("VIEWER", "ADMIN")).toBe(false);
    expect(roleAtLeast("ADMIN", "VIEWER")).toBe(true);
    expect(roleAtLeast("ADMIN", "OWNER")).toBe(false);
    expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
  });
});

describe("projectMembershipWhere", () => {
  it("includes owner clause and optional member email", () => {
    expect(projectMembershipWhere("u1")).toEqual({ OR: [{ userId: "u1" }] });
    expect(projectMembershipWhere("u1", "  Alex@Example.com ")).toEqual({
      OR: [
        { userId: "u1" },
        { members: { some: { email: "alex@example.com" } } },
      ],
    });
  });
});
