export const STATE_THRESH = {
  s1Max: 40.0,
  s2Min: 30.0,
  s2Max: 78.0,
  s3Min: 79.0,
  s3Max: 125.0
} as const;

export const FEEDBACK_THRESH = {
  torsoForwardMin: 15.0,
  torsoBackwardMax: 55.0,
  lowerHipMin: 55.0,
  lowerHipMax: 90.0,
  kneeOverToeMax: 42.0,
  tooDeepMin: 130.0
} as const;

export const OFFSET_THRESH = 45.0;
export const INACTIVE_THRESH_SEC = 15;