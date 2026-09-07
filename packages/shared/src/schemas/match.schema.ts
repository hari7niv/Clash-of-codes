import { z } from 'zod';
import { languageSchema, sourceCodeSchema } from './submission.schema';

export const restSubmitSchema = z.object({
  code: z.string().min(1).max(64 * 1024),
  language: languageSchema,
  action: z.enum(['run', 'submit']).default('submit'),
});

export type RestSubmitInput = z.infer<typeof restSubmitSchema>;

export const uuidParamSchema = z.string().uuid();
