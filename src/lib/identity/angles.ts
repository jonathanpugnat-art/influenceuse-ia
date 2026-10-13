export type FaceAngle = "front" | "three_quarter_left" | "three_quarter_right";

export type FaceRefCandidate = {
  key: string;
  contentType: string;
  yaw: number;
  score?: number | null;
};

const ANGLE_ORDER: readonly FaceAngle[] = [
  "front",
  "three_quarter_left",
  "three_quarter_right",
];

/**
 * Estimate yaw from InsightFace 5-point landmarks (left eye, right eye, nose, mouth L/R).
 * Negative ≈ looking left, positive ≈ looking right.
 */
export function estimateYaw(kps: [number, number][]): number {
  if (kps.length < 3) return 0;
  const leftEye = kps[0]!;
  const rightEye = kps[1]!;
  const nose = kps[2]!;
  const midX = (leftEye[0] + rightEye[0]) / 2;
  const eyeSpan = Math.max(1, Math.abs(rightEye[0] - leftEye[0]));
  return (nose[0] - midX) / eyeSpan;
}

export function yawToAngle(yaw: number): FaceAngle {
  if (yaw <= -0.12) return "three_quarter_left";
  if (yaw >= 0.12) return "three_quarter_right";
  return "front";
}

export function pickAngleSources(
  candidates: FaceRefCandidate[],
): Partial<Record<FaceAngle, FaceRefCandidate>> {
  const buckets: Record<FaceAngle, FaceRefCandidate[]> = {
    front: [],
    three_quarter_left: [],
    three_quarter_right: [],
  };
  for (const candidate of candidates) {
    buckets[yawToAngle(candidate.yaw)].push(candidate);
  }
  const picked: Partial<Record<FaceAngle, FaceRefCandidate>> = {};
  for (const angle of ANGLE_ORDER) {
    const list = buckets[angle];
    if (list.length === 0) continue;
    list.sort((a, b) => Math.abs(a.yaw) - Math.abs(b.yaw));
    if (angle === "front") {
      picked.front = list[0];
    } else {
      list.sort((a, b) => Math.abs(b.yaw) - Math.abs(a.yaw));
      picked[angle] = list[0];
    }
  }
  return picked;
}

export function pickReference<T extends { angle: FaceAngle }>(
  refs: T[],
  desired: FaceAngle,
): T | null {
  const exact = refs.find((ref) => ref.angle === desired);
  if (exact) return exact;
  const front = refs.find((ref) => ref.angle === "front");
  return front ?? refs[0] ?? null;
}

export function isFaceAngle(value: unknown): value is FaceAngle {
  return (
    value === "front" ||
    value === "three_quarter_left" ||
    value === "three_quarter_right"
  );
}
