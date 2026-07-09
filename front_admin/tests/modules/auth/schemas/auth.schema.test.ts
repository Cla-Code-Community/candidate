import { describe, expect, it } from "vitest";
import {
  AuthStateSchema,
  LoginCredentialsSchema,
  MetricDataSchema,
  ProcessDataSchema,
  RoleSchema,
  UserSchema,
} from "../../../../src/modules/auth/schemas/auth.schema";

function Icon() {
  return null;
}

describe("auth schemas", () => {
  it("validates login credentials and applies rememberMe default", () => {
    expect(
      LoginCredentialsSchema.parse({
        email: " admin@example.com ",
        password: "12345678",
      }),
    ).toEqual({
      email: "admin@example.com",
      password: "12345678",
      rememberMe: false,
    });

    expect(() =>
      LoginCredentialsSchema.parse({ email: "bad", password: "123" }),
    ).toThrow();
  });

  it("validates roles and user auth state", () => {
    expect(RoleSchema.parse("support")).toBe("support");

    const user = UserSchema.parse({
      id: "u1",
      name: "Admin",
      email: null,
      role: "admin",
      avatar: "",
      permissions: { dashboard: ["read"] },
    });

    expect(
      AuthStateSchema.parse({
        isLoggedIn: true,
        isLoading: false,
        errorMessage: "",
        user,
      }).user?.permissions.dashboard,
    ).toEqual(["read"]);
  });

  it("validates metric and process view models", () => {
    expect(
      MetricDataSchema.parse({
        title: "Usuários",
        value: 10,
        icon: Icon,
        changeType: "up",
      }).changeType,
    ).toBe("up");

    expect(
      ProcessDataSchema.parse({
        id: "p1",
        position: "Engenheiro",
        company: "Cand",
        applicants: 4,
        slaStatus: "warning",
        slaDays: 2,
      }).slaStatus,
    ).toBe("warning");
  });
});
