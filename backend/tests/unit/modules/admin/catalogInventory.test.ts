import { describe,expect,it,vi,afterEach } from "vitest";
import { JobsCountResultSchema } from "../../../../src/modules/admin/scrapers/scrapers.types";
import { scraperClient } from "../../../../src/modules/admin/scrapers/scraperClient";
const fixture={total:205,sources:[{source:"Green House",provider:"greenhouse",total:200},{source:"LinkedIn",provider:"linkedin",total:4},{source:null,provider:"unknown",total:1}],configuredProviders:["greenhouse","themuse"]};
afterEach(()=>vi.unstubAllGlobals());
describe("complete catalog attribution",()=>{
 it("forwards global totals independently of preview and keeps configured absent provider",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({...fixture,token:"secret"})}));
  const result=await scraperClient.getJobsCount();expect(result).toEqual(fixture);expect(result.configuredProviders).toContain("themuse");expect(result.sources?.reduce((n,s)=>n+s.total,0)).toBe(result.total);
 });
 it.each([{total:0,sources:[],configuredProviders:["themuse"]},{total:205,sources:null,configuredProviders:["themuse"]},{total:205,sources:fixture.sources,configuredProviders:null},{total:205}])("accepts zero, partial and old contract: %j",payload=>{expect(JobsCountResultSchema.parse(payload)).toEqual(payload)});
 it.each([{...fixture,total:206},{...fixture,sources:[{source:"x",provider:"made-up",total:205}]},{...fixture,configuredProviders:["gupy","gupy"]},{...fixture,sources:[{source:null,provider:"unknown",total:-1}]}])("rejects incompatible counts %j",payload=>expect(JobsCountResultSchema.safeParse(payload).success).toBe(false));
});
