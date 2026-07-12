import { sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { permissionRules } from "../../../db/schema/permissionRules";
import { ROLE_LEVEL, type Role } from "./roles";
import {
  permissionMatrix,
  type Action,
  type PermissionMatrix,
  type Resource,
} from "./permissionMatrix";

export type PermissionRuleView = {
  resource: Resource;
  action: Action;
  defaultMinRole: Role;
  minRole: Role;
  customized: boolean;
  reason?: string | null;
};

export type UpdatePermissionRuleInput = {
  resource: Resource;
  action: Action;
  minRole: Role;
  reason?: string | null;
};

const IMMUTABLE_RULES = new Set([
  "permissions.manage",
  "users.change_role",
  "users.delete",
]);

function ruleKey(resource: Resource, action: Action) {
  return `${resource}.${action}`;
}

function cloneDefaultMatrix(): PermissionMatrix {
  return Object.fromEntries(
    Object.entries(permissionMatrix).map(([resource, actions]) => [
      resource,
      { ...actions },
    ]),
  ) as PermissionMatrix;
}

export class PermissionsService {
  async getRules(): Promise<PermissionRuleView[]> {
    const overrides = await db.select().from(permissionRules);
    const overrideMap = new Map(
      overrides.map((rule) => [
        ruleKey(rule.resource as Resource, rule.action as Action),
        rule,
      ]),
    );

    return Object.entries(permissionMatrix).flatMap(([resource, actions]) =>
      Object.entries(actions).map(([action, defaultMinRole]) => {
        const override = overrideMap.get(ruleKey(resource as Resource, action as Action));

        return {
          resource: resource as Resource,
          action: action as Action,
          defaultMinRole: defaultMinRole as Role,
          minRole: (override?.minRole ?? defaultMinRole) as Role,
          customized: Boolean(override),
          reason: override?.reason ?? null,
        };
      }),
    );
  }

  async getEffectiveMatrix(): Promise<PermissionMatrix> {
    const matrix = cloneDefaultMatrix();
    const overrides = await db.select().from(permissionRules);

    for (const rule of overrides) {
      const resource = rule.resource as Resource;
      const action = rule.action as Action;
      if (matrix[resource]?.[action]) {
        matrix[resource][action] = rule.minRole;
      }
    }

    return matrix;
  }

  async can(role: Role, resource: Resource, action: Action): Promise<boolean> {
    const matrix = await this.getEffectiveMatrix().catch(() => permissionMatrix);
    const minRole = matrix[resource]?.[action];
    if (!minRole) return false;
    return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
  }

  async updateRules(inputs: UpdatePermissionRuleInput[]): Promise<PermissionRuleView[]> {
    for (const input of inputs) {
      this.assertRuleCanBeUpdated(input);
    }

    await Promise.all(
      inputs.map((input) =>
        db
          .insert(permissionRules)
          .values({
            resource: input.resource,
            action: input.action,
            minRole: input.minRole,
            reason: input.reason,
          })
          .onConflictDoUpdate({
            target: [permissionRules.resource, permissionRules.action],
            set: {
              minRole: input.minRole,
              reason: input.reason,
              updatedAt: sql`now()`,
            },
          }),
      ),
    );

    return this.getRules();
  }

  private assertRuleCanBeUpdated(input: UpdatePermissionRuleInput): void {
    const defaultMinRole = permissionMatrix[input.resource]?.[input.action];
    if (!defaultMinRole) {
      throw new Error(`Regra desconhecida: ${ruleKey(input.resource, input.action)}`);
    }

    if (IMMUTABLE_RULES.has(ruleKey(input.resource, input.action))) {
      throw new Error(`Regra imutavel: ${ruleKey(input.resource, input.action)}`);
    }
  }
}

export const permissionsService = new PermissionsService();
