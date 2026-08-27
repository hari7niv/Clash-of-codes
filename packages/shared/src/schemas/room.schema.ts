import { z } from 'zod';

/** A room code is a 6-char uppercase alphanumeric string, e.g. "7Q4K2Z". */
export const roomCodeSchema = z
  .string()
  .length(6)
  .regex(/^[A-Z0-9]+$/, 'Room codes are 6 uppercase alphanumeric characters');

export const createRoomSchema = z.object({
  /** Optional: pin a specific problem, otherwise one is chosen at start. */
  problemId: z.string().uuid().optional(),
  isPrivate: z.boolean().default(true),
  maxPlayers: z.number().int().min(2).max(8).default(2),
  timeControl: z.string().default('rapid'),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
});

export const roomCodeParamSchema = z.object({
  code: roomCodeSchema,
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
