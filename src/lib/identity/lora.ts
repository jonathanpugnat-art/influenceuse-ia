export function makeTriggerWord(characterId: string): string {
  const compact = characterId.replace(/-/g, "").slice(0, 5).toUpperCase();
  return `OFM${compact}`;
}

export function buildLoraPrompt(trigger: string, scenePrompt: string): string {
  return `${trigger}, ${scenePrompt}`;
}

export function shouldEnableLora(input: {
  loraMean: number | null;
  referenceMean: number | null;
}): boolean {
  if (input.loraMean === null || !Number.isFinite(input.loraMean)) return false;
  if (input.referenceMean === null || !Number.isFinite(input.referenceMean)) {
    return input.loraMean >= 0.7;
  }
  return input.loraMean > input.referenceMean;
}

/** Active le LoRA après training : score réel, ou acceptation si scoring désactivé. */
export function decideLoraActivation(input: {
  predictionSucceeded: boolean;
  scoringEnabled: boolean;
  loraMean: number | null;
  referenceMean: number | null;
}): boolean {
  if (!input.predictionSucceeded) return false;
  if (!input.scoringEnabled) return true;
  return shouldEnableLora({
    loraMean: input.loraMean,
    referenceMean: input.referenceMean,
  });
}

export function shouldUseLoraForGeneration(input: {
  loraEnabledFlag: boolean;
  characterLoraEnabled: boolean;
  replicateVersion: string | null | undefined;
  status: string | null | undefined;
}): boolean {
  return (
    input.loraEnabledFlag &&
    input.characterLoraEnabled &&
    input.status === "ready" &&
    typeof input.replicateVersion === "string" &&
    input.replicateVersion.length > 0
  );
}
