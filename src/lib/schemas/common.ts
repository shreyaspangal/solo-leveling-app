import { z } from "zod";

// Shared primitive validators for the schema layer. Add to this file rather
// than redefining a primitive per schema file -- Finance/Fitness (ADR-004/005)
// will need isoDate too.
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
