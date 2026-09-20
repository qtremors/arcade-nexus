import { it, expect } from "vitest";
import { apiBaseUrl } from "../client";
it("uses one API URL convention for default, root URLs, and existing /api URLs", () => {
  expect(apiBaseUrl("")).toBe("/api");
  expect(apiBaseUrl("http://localhost:8000/")).toBe(
    "http://localhost:8000/api",
  );
  expect(apiBaseUrl("http://localhost:8000/api/")).toBe(
    "http://localhost:8000/api",
  );
});
