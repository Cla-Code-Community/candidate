import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import {
  professionalFamilies,
  taxonomyVersion,
} from "../types/professionalTaxonomy";

export const jobFilterOptions = {
  taxonomyVersion,
  families: professionalFamilies,
  familyModes: [
    { id: "any", label: "Principal ou relacionada", default: true },
    { id: "primary", label: "Somente família principal", default: false },
  ],
};
const etag = `"${createHash("sha256").update(JSON.stringify(jobFilterOptions)).digest("hex")}"`;

export function jobFilterOptionsController(_req: Request, res: Response): void {
  res.set("Cache-Control", "public, max-age=3600");
  res.set("ETag", etag);
  // Express handles If-None-Match freshness and 304 on res.json.
  res.json(jobFilterOptions);
}
