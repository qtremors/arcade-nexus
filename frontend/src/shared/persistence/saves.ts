import { z } from "zod";
import { envelopeSchema, type SaveEnvelope } from "../../contracts/saves";
export { envelopeSchema, type SaveEnvelope } from "../../contracts/saves";
import { getDescriptor } from "../../games/descriptors";
export function readSave(value: unknown, slug: string): SaveEnvelope {
  const result = envelopeSchema.parse(value);
  if (result.game !== slug)
    throw new Error("This save belongs to another game.");
  const descriptor = getDescriptor(slug);
  if (result.rules_version > descriptor.rulesVersion)
    throw new Error("Update Arcade Nexus to open this newer save.");
  return { ...result, format: 2 };
}

export async function validateSave(
  value: unknown,
  slug: string,
): Promise<SaveEnvelope> {
  try {
    const envelope = readSave(value, slug);
    const codec = await getDescriptor(slug).codec();
    return codec.decodeSave(envelope);
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new Error(
        "This save contains values outside supported limits. Your current run has been kept.",
      );
    throw error;
  }
}
