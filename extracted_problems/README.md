# Clash of Codes - 30 Problem Seed Bank

This folder contains 30 original, structured problem definitions inspired by common competitive-programming patterns.

Each JSON file contains:
- problem metadata
- short problem statement
- Java `class Solution` starter code
- method signature
- public examples
- hidden-test slots
- judge configuration

## Important
The included examples are seed tests, not a production-grade test suite. For Clash of Codes, generate many more hidden tests from constraints using a trusted reference solution.

Do not copy proprietary problem statements, hidden tests, or platform content from sites such as LeetCode unless the applicable license/terms explicitly allow redistribution. These files intentionally use original short statements.

## Recommended production layout

problem.json
reference-solution/
test-generator/
validator/
tests/public/
tests/hidden/

For each generated input:
1. Run the trusted reference solution.
2. Capture its canonical output.
3. Store the input and expected output.
4. Run user code in a sandbox.
5. Compare output or invoke the custom validator.
