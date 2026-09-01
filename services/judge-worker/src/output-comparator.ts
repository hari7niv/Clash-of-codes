const FLOAT_TOLERANCE = parseFloat(process.env.FLOAT_TOLERANCE || "1e-9");

/**
 * Normalize output by stripping whitespace
 */
export function normalizeOutput(output: string): string {
  return output.trim();
}

/**
 * Check if two strings are equal (case-sensitive)
 */
export function stringEqual(expected: string, actual: string): boolean {
  return normalizeOutput(expected) === normalizeOutput(actual);
}

/**
 * Try to parse as number and compare with floating point tolerance
 */
export function floatEqual(expected: string, actual: string): boolean {
  const expNum = parseFloat(expected);
  const actNum = parseFloat(actual);

  if (isNaN(expNum) || isNaN(actNum)) {
    return false;
  }

  // Handle exact zero comparison
  if (expNum === 0 && actNum === 0) {
    return true;
  }

  // Relative error: |a - b| / |b| < TOLERANCE
  return Math.abs(expNum - actNum) / Math.abs(actNum) < FLOAT_TOLERANCE;
}

/**
 * Split output into lines and compare
 */
export function compareLineByLine(
  expected: string,
  actual: string
): { passed: boolean; details: string[] } {
  const expectedLines = normalizeOutput(expected)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const actualLines = normalizeOutput(actual)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const details: string[] = [];

  if (expectedLines.length !== actualLines.length) {
    details.push(
      `Line count mismatch: expected ${expectedLines.length}, got ${actualLines.length}`
    );
    return { passed: false, details };
  }

  for (let i = 0; i < expectedLines.length; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];

    // Try string equality first
    if (stringEqual(exp, act)) {
      details.push(`Line ${i + 1}: ✓ PASS`);
      continue;
    }

    // Try float equality
    if (floatEqual(exp, act)) {
      details.push(`Line ${i + 1}: ✓ PASS (float match)`);
      continue;
    }

    details.push(`Line ${i + 1}: ✗ FAIL - expected "${exp}", got "${act}"`);
    return { passed: false, details };
  }

  return { passed: true, details };
}

/**
 * Main comparison function - compares expected vs actual output
 */
export function compareOutput(
  expected: string,
  actual: string
): { passed: boolean; details: string[] } {
  // Empty string handling
  if (!expected && !actual) {
    return { passed: true, details: ["Both outputs empty"] };
  }

  if (!expected) {
    return { passed: false, details: ["Expected output is empty, but actual output is not"] };
  }

  if (!actual) {
    return { passed: false, details: ["Actual output is empty, but expected output is not"] };
  }

  // Try line-by-line comparison
  return compareLineByLine(expected, actual);
}
