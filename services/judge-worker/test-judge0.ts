import { Judge0Client } from "./src/judge0-client";

async function testJudge0() {
  const client = new Judge0Client("http://localhost:2358");

  console.log("=== Testing Judge0 with Judge0Client ===\n");

  // 1. Python
  console.log("--- Testing Python 3 ---");
  const pySub = await client.submit({
    language_id: 71,
    source_code: "import sys\nname = sys.stdin.read().strip()\nprint('Hello ' + name)",
    stdin: "ClashOfCode",
  });
  const pyRes = await client.pollResult(pySub.token);
  console.log("Python Result:", pyRes.status.description, "| stdout:", JSON.stringify(pyRes.stdout));

  // 2. JavaScript
  console.log("\n--- Testing JavaScript (Node.js) ---");
  const jsSub = await client.submit({
    language_id: 63,
    source_code: "const fs = require('fs'); const input = fs.readFileSync(0, 'utf-8').trim(); console.log(Number(input) * 10);",
    stdin: "42",
  });
  const jsRes = await client.pollResult(jsSub.token);
  console.log("JavaScript Result:", jsRes.status.description, "| stdout:", JSON.stringify(jsRes.stdout));

  // 3. C++
  console.log("\n--- Testing C++ ---");
  const cppSub = await client.submit({
    language_id: 54,
    source_code: "#include <iostream>\nint main() { int n; std::cin >> n; std::cout << (n + 100); return 0; }",
    stdin: "50",
  });
  const cppRes = await client.pollResult(cppSub.token);
  console.log("C++ Result:", cppRes.status.description, "| stdout:", JSON.stringify(cppRes.stdout));

  // 4. Java
  console.log("\n--- Testing Java ---");
  const javaSub = await client.submit({
    language_id: 62,
    source_code: "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner s = new Scanner(System.in);\n    System.out.println(s.nextInt() * 2);\n  }\n}",
    stdin: "25",
  });
  const javaRes = await client.pollResult(javaSub.token);
  console.log("Java Result:", javaRes.status.description, "| stdout:", JSON.stringify(javaRes.stdout));

  console.log("\n=== All Language Tests Complete! ===");
}

testJudge0().catch(console.error);
