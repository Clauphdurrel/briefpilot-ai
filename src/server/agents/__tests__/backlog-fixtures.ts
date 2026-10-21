import { readFileSync } from "node:fs";
import { backlogSchema, backlogAgentInputSchema } from "@/server/validators/backlog.schema";
export const backlogFixture = () => backlogSchema.parse(JSON.parse(readFileSync("docs/prompts/backlog-generator.example.json", "utf8")));
export const backlogInput = () => backlogAgentInputSchema.parse(JSON.parse(readFileSync("docs/prompts/backlog-generator.input.example.json", "utf8")));
