import { eq, type AnyColumn } from "drizzle-orm";
import { AppError } from "../errors";

export function assertOwnsResource(
  sessionUserId: string,
  resourceUserId: string,
  notFoundMessage = "Recurso não encontrado.",
): void {
  if (sessionUserId !== resourceUserId) {
    throw AppError.notFound(notFoundMessage);
  }
}

export function ownedBy<TUserIdColumn extends AnyColumn<{ data: string }>>(
  userId: string,
  userIdColumn: TUserIdColumn,
) {
  return eq(userIdColumn, userId);
}
