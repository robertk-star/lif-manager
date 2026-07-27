import { z } from "zod";

export const PRACTICE_AREAS = [
  "Social Security Disability",
  "SSI",
  "SSDI",
  "Veterans Disability",
  "Workers' Compensation",
  "Personal Injury",
  "Other",
] as const;

export const MONTHLY_CAPACITIES = ["1–10", "11–25", "26–50", "51–100", "100+"] as const;

export const partnerAccessSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  firmName: z.string().min(1).max(300).trim(),
  email: z.string().min(1).email().max(320),
  phone: z.string().min(1).max(40).trim(),
  statesServed: z.string().min(1).max(2000).trim(),
  practiceArea: z.enum(PRACTICE_AREAS),
  monthlyLeadCapacity: z.enum(MONTHLY_CAPACITIES),
  website: z.string().max(500).trim().optional(),
  message: z.string().max(5000).trim().optional(),
  companyWebsite: z.string().max(200).optional(),
});

export type PartnerAccessInput = z.infer<typeof partnerAccessSchema>;
