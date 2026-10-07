import { describe, expect, it } from "vitest";
import swaggerSpec from "../../src/swagger";

type SwaggerSpec = {
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any>; responses?: Record<string, any> };
};

describe("swagger", () => {
  it("documenta a API v1 e os endpoints principais", () => {
    const spec = swaggerSpec as SwaggerSpec;

    expect(spec.servers).toContainEqual(
      expect.objectContaining({ url: "/api/v1" }),
    );
    expect(spec.paths).toEqual(
      expect.objectContaining({
        "/auth/login": expect.any(Object),
        "/users/profile": expect.any(Object),
        "/jobs/search": expect.any(Object),
        "/saved-jobs": expect.any(Object),
        "/notifications": expect.any(Object),
        "/admin/users": expect.any(Object),
      }),
    );
  });

  it("descreve contratos, exemplos e respostas para os endpoints principais", () => {
    const spec = swaggerSpec as SwaggerSpec;

    expect(spec.paths?.["/notifications"]?.get.responses[200].content[
      "application/json"
    ].schema).toEqual({ $ref: "#/components/schemas/NotificationListResponse" });
    expect(spec.paths?.["/saved-jobs/{id}"]).toEqual(
      expect.objectContaining({ get: expect.any(Object), patch: expect.any(Object), delete: expect.any(Object) }),
    );
    expect(spec.paths?.["/notifications/read-all"]?.patch.responses).toEqual(
      expect.objectContaining({ 400: { $ref: "#/components/responses/BadRequest" }, 401: { $ref: "#/components/responses/Unauthorized" } }),
    );
    expect(spec.paths?.["/users/preferences"]).toEqual(
      expect.objectContaining({ get: expect.any(Object), post: expect.any(Object), patch: expect.any(Object) }),
    );
    expect(spec.paths?.["/admin/users/{id}"]).toEqual(
      expect.objectContaining({ get: expect.any(Object), delete: expect.any(Object) }),
    );
    expect(spec.components?.schemas).toEqual(
      expect.objectContaining({
        RegisterRequest: expect.any(Object),
        ProfileUpdateRequest: expect.any(Object),
        SavedJobRequest: expect.any(Object),
        NotificationListResponse: expect.any(Object),
      }),
    );
    expect(spec.components?.responses).toEqual(
      expect.objectContaining({
        BadRequest: expect.any(Object),
        Unauthorized: expect.any(Object),
        Forbidden: expect.any(Object),
        NotFound: expect.any(Object),
      }),
    );
    expect(spec.paths).not.toHaveProperty("/api/keywords");
  });
});

describe("PAV-124 OpenAPI contract", () => {
  it("validates the complete OpenAPI document and references", async () => {
    const { default: SwaggerParser } = await import("@apidevtools/swagger-parser");
    await expect(SwaggerParser.validate(JSON.parse(JSON.stringify(swaggerSpec)))).resolves.toBeDefined();
  });
  it("uses canonical enums, serializations, mode default, errors and cache headers", async () => {
    const { professionalFamilies } = await import("../../src/modules/jobs/types/professionalTaxonomy");
    const spec = swaggerSpec as SwaggerSpec;
    const search = spec.paths?.["/jobs/search"]?.get;
    const family = search.parameters.find((p: { name: string }) => p.name === "family");
    expect(family.schema.items.enum).toEqual(professionalFamilies.map(f => f.id));
    expect(family).toMatchObject({ style: "form", explode: true, schema: { maxItems: 13 } });
    expect(family.description).toContain("family=backend,fullstack");
    expect(family.description).toContain("family=backend&family=fullstack");
    expect(search.parameters.find((p: { name: string }) => p.name === "familyMode").schema).toEqual({ type: "string", enum: ["primary", "any"], default: "any" });
    expect(search.responses[400].content["application/json"].examples.family.value.code).toBe("INVALID_JOB_FAMILY");
    expect(search.responses[400].content["application/json"].examples.mode.value.code).toBe("INVALID_FAMILY_MODE");
    const options = spec.paths?.["/jobs/filters/options"]?.get;
    expect(options.responses[200].headers["Cache-Control"].example).toBe("public, max-age=3600");
    expect(options.responses[304]).toBeDefined();
  });
});
