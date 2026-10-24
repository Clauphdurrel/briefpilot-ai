import { z } from "zod";
export const analyticsConsentSchema = z.strictObject({ analyticsConsent: z.boolean() });
