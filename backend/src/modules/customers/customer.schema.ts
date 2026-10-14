// Business: the customer directory row — who the person is and where they are.
// Technical: one Zod shape is the only place customer output format exists; it declares its own
// fields so the contract layer never imports from the data layer.
import { z } from 'zod';

export const customerRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  area: z.string().min(1),
});

export type CustomerRecordView = z.infer<typeof customerRecordSchema>;
