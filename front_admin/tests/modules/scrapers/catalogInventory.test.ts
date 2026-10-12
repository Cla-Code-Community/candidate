import {describe,it,expect} from "vitest";
import {buildCatalogInventory} from "../../../src/modules/scrapers/services/catalogInventory";
import {ScraperJobsCountResponseSchema} from "../../../src/lib/api/types";
describe("global inventory independent of preview",()=>{
 it("keeps configured zero and aggregates primary-source aliases exactly once",()=>{
  const rows=buildCatalogInventory({total:205,configuredProviders:["greenhouse","themuse"],sources:[{source:"Green House",provider:"greenhouse",total:200},{source:"LinkedIn",provider:"linkedin",total:4},{source:null,provider:"unknown",total:1}]});
  expect(rows.find(r=>r.id==="themuse")).toMatchObject({configured:true,catalogJobs:0,observed:false});
  expect(rows.find(r=>r.id==="linkedin")).toMatchObject({configured:false,catalogJobs:4,observed:true});
  expect(rows.find(r=>r.id==="source:null")).toMatchObject({catalogJobs:1,name:"Sem fonte principal"});
  expect(rows.reduce((n,r)=>n+(r.catalogJobs??0),0)).toBe(205);
 });
 it("retains unknown literal source and merges known aliases",()=>{
  const rows=buildCatalogInventory({total:7,configuredProviders:null,sources:[{source:"Green House",provider:"greenhouse",total:2},{source:"Greenhouse",provider:"greenhouse",total:3},{source:"Indeed",provider:"unknown",total:2}]});
  expect(rows.find(r=>r.id==="greenhouse")).toMatchObject({catalogJobs:5,configured:null});
  expect(rows.find(r=>r.name==="Indeed")).toMatchObject({catalogJobs:2,configured:null});
 });
 it("keeps a literal null source distinct from missing attribution",()=>{
  const rows=buildCatalogInventory({total:2,configuredProviders:[],sources:[{source:null,provider:"unknown",total:1},{source:"null",provider:"unknown",total:1}]});expect(rows).toHaveLength(2);expect(rows.reduce((sum,row)=>sum+(row.catalogJobs??0),0)).toBe(2);
 });
 it("does not turn missing aggregation into zero",()=>{
  expect(buildCatalogInventory({total:10,sources:null,configuredProviders:["gupy"]})).toEqual([expect.objectContaining({id:"gupy",catalogJobs:null,configured:true,observed:null})]);
  expect(buildCatalogInventory({total:10})).toEqual([]);
  expect(buildCatalogInventory(null)).toEqual([]);
 });
 it("distinguishes known empty catalog from unknown inventory",()=>{
  expect(buildCatalogInventory({total:0,sources:[],configuredProviders:["gupy"]})[0].catalogJobs).toBe(0);
  expect(ScraperJobsCountResponseSchema.parse({total:0}).sources).toBeUndefined();
  expect(ScraperJobsCountResponseSchema.safeParse({total:4,sources:[{source:"Gupy",provider:"gupy",total:3}]}).success).toBe(false);
 });
});

describe("normalized catalog provenance", () => {
  it("consolidates order, repetition, whitespace and aliases without mixing combinations", () => {
    const sources = [
      { source: "Adzuna, Gupy", provider: "unknown" as const, total: 7 },
      { source: " gupy , ADZUNA , ", provider: "unknown" as const, total: 11 },
      { source: "Adzuna, Gupy, Adzuna", provider: "unknown" as const, total: 5 },
      { source: "Adzuna, Jooble", provider: "unknown" as const, total: 13 },
      { source: "Jooble, Adzuna, Jooble", provider: "unknown" as const, total: 17 },
      { source: "Adzuna", provider: "adzuna" as const, total: 19 },
      { source: "Jooble, Gupy, Adzuna", provider: "unknown" as const, total: 23 },
      { source: "Adzuna, Jooble, Gupy, Gupy", provider: "unknown" as const, total: 29 },
      { source: "Green House, greenHOUSE, Gupy", provider: "unknown" as const, total: 31 },
    ];
    const total = sources.reduce((sum, source) => sum + source.total, 0);
    const rows = buildCatalogInventory(ScraperJobsCountResponseSchema.parse({ total, configuredProviders: ["adzuna", "themuse"], sources }));
    expect(rows).toHaveLength(6);
    expect(rows.find(row => row.name === "Adzuna + Gupy")).toMatchObject({ catalogJobs: 23, observed: true });
    expect(rows.find(row => row.name === "Adzuna + Jooble")).toMatchObject({ catalogJobs: 30 });
    expect(rows.find(row => row.name === "Adzuna + Gupy + Jooble")).toMatchObject({ catalogJobs: 52 });
    expect(rows.find(row => row.id === "adzuna")).toMatchObject({ catalogJobs: 19, configured: true });
    expect(rows.find(row => row.name === "Greenhouse + Gupy")).toMatchObject({ catalogJobs: 31 });
    expect(rows.find(row => row.id === "themuse")).toMatchObject({ catalogJobs: 0, configured: true });
    expect(rows.reduce((sum, row) => sum + (row.catalogJobs ?? 0), 0)).toBe(total);
    expect(buildCatalogInventory({ total, configuredProviders: ["adzuna", "themuse"], sources: [...sources].reverse() })).toEqual(rows);
  });

  it("does not create empty providers or merge distinct unrecognized sources", () => {
    const rows = buildCatalogInventory({ total: 47, configuredProviders: [], sources: [
      { source: null, provider: "unknown", total: 3 },
      { source: " , , ", provider: "unknown", total: 7 },
      { source: " Gupy, , Gupy ", provider: "unknown", total: 11 },
      { source: "Indeed, Adzuna", provider: "unknown", total: 13 },
      { source: "Another source, Adzuna", provider: "unknown", total: 13 },
    ] });
    expect(rows).toHaveLength(4);
    expect(rows.find(row => row.id === "source:null")).toMatchObject({ catalogJobs: 10, configured: null });
    expect(rows.find(row => row.id === "gupy")).toMatchObject({ name: "Gupy", catalogJobs: 11 });
    expect(rows.filter(row => row.name.includes(" + "))).toHaveLength(2);
    expect(rows.every(row => row.name.trim().length > 0)).toBe(true);
    expect(rows.reduce((sum, row) => sum + (row.catalogJobs ?? 0), 0)).toBe(47);
  });
});
