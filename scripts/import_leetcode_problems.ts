import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";
const sql = postgres(DATABASE_URL);

interface FunctionParameter {
  name: string;
  type: string;
}

interface FunctionSignature {
  name: string;
  params: FunctionParameter[];
  returnType: string;
}

// Java method signature parser
function parseJavaSignature(signatureStr: string): FunctionSignature {
  // Example: "int[] twoSum(int[] nums, int target)"
  const parts = signatureStr.trim().split('(');
  const returnTypeAndName = parts[0].trim().split(/\s+/);
  const name = returnTypeAndName.pop()!;
  const returnType = returnTypeAndName.join(' ');
  
  const paramsStr = parts[1].replace(')', '').trim();
  const params: FunctionParameter[] = [];
  if (paramsStr) {
    const paramParts = paramsStr.split(',');
    for (const p of paramParts) {
      const pTrimmed = p.trim().split(/\s+/);
      const paramName = pTrimmed.pop()!;
      const paramType = pTrimmed.join(' ');
      params.push({ name: paramName, type: paramType });
    }
  }
  return { name, returnType, params };
}

// Python type mapping
function mapTypeToPython(javaType: string): string {
  switch (javaType) {
    case 'int': return 'int';
    case 'float':
    case 'double': return 'float';
    case 'String': return 'str';
    case 'boolean': return 'bool';
    case 'int[]': return 'List[int]';
    case 'String[]': return 'List[str]';
    case 'int[][]': return 'List[List[int]]';
    case 'ListNode': return 'Optional[ListNode]';
    case 'TreeNode': return 'Optional[TreeNode]';
    default: return 'Any';
  }
}

function generatePythonStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => `${p.name}: ${mapTypeToPython(p.type)}`).join(', ');
  const retType = mapTypeToPython(sig.returnType);
  return `from typing import *\n\nclass Solution:\n    def ${sig.name}(self, ${params}) -> ${retType}:\n        # TODO: implement\n        pass\n`;
}

function generateJSStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => p.name).join(', ');
  return `class Solution {\n    ${sig.name}(${params}) {\n        // TODO: implement\n        return null;\n    }\n}\n`;
}

function mapTypeToCpp(t: string): string {
  switch (t) {
    case 'int': return 'int';
    case 'double': return 'double';
    case 'char': return 'char';
    case 'String': return 'string';
    case 'boolean': return 'bool';
    case 'int[]': return 'vector<int>';
    case 'double[]': return 'vector<double>';
    case 'char[]': return 'vector<char>';
    case 'String[]': return 'vector<string>';
    case 'int[][]': return 'vector<vector<int>>';
    case 'double[][]': return 'vector<vector<double>>';
    case 'char[][]': return 'vector<vector<char>>';
    case 'ListNode': return 'ListNode*';
    case 'TreeNode': return 'TreeNode*';
    default: return 'void';
  }
}

function generateCppStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => `${mapTypeToCpp(p.type)} ${p.name}`).join(', ');
  const retType = mapTypeToCpp(sig.returnType);
  return `class Solution {\npublic:\n    ${retType} ${sig.name}(${params}) {\n        // TODO: implement\n        \n    }\n};\n`;
}

function generateJavaStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => `${p.type} ${p.name}`).join(', ');
  return `class Solution {\n    public ${sig.returnType} ${sig.name}(${params}) {\n        // TODO: implement\n        return null;\n    }\n}\n`;
}

async function main() {
  const dirPath = path.join(process.cwd(), 'extracted_problems');
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  let importedCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
    const problem = JSON.parse(content);
    
    // Check if we can parse the java signature
    const javaSig = problem.languages?.java?.method_signature;
    if (!javaSig) {
      console.warn(`Skipping ${file}: No java method_signature found.`);
      continue;
    }

    try {
      const signature = parseJavaSignature(javaSig);
      const pythonStarter = generatePythonStarter(signature);
      const jsStarter = generateJSStarter(signature);
      const javaStarter = generateJavaStarter(signature);
      const cppStarter = generateCppStarter(signature);
      
      const starterCode = {
        python: pythonStarter,
        javascript: jsStarter,
        js: jsStarter,
        python3: pythonStarter,
        java: javaStarter,
        cpp: cppStarter,
        "c++": cppStarter
      };

      const problemId = uuidv4();
      
      // Upsert or insert problem
      await sql`
        INSERT INTO problems (id, slug, title, statement, difficulty, starter_code, function_signature, is_draft, tags)
        VALUES (
          ${problemId}, 
          ${problem.slug}, 
          ${problem.title}, 
          ${problem.statement}, 
          ${problem.difficulty.toLowerCase()}, 
          ${starterCode as any}, 
          ${signature as any}, 
          false,
          ${['Array']} 
        )
        ON CONFLICT (slug) DO UPDATE SET 
          title = EXCLUDED.title,
          statement = EXCLUDED.statement,
          difficulty = LOWER(EXCLUDED.difficulty),
          starter_code = EXCLUDED.starter_code,
          function_signature = EXCLUDED.function_signature,
          is_draft = false
      `;

      // fetch problem id after possible upsert
      const [{ id: realProblemId }] = await sql`SELECT id FROM problems WHERE slug = ${problem.slug}`;

      // Insert test cases
      // Clear existing tests for problem
      await sql`DELETE FROM test_cases WHERE problem_id = ${realProblemId}`;
      
      let ordinal = 1;
      
      for (const t of problem.public_tests) {
        await sql`
          INSERT INTO test_cases (problem_id, input, expected_output, is_sample, ordinal)
          VALUES (${realProblemId}, ${JSON.stringify(t.input)}, ${JSON.stringify(t.expected_output)}, true, ${ordinal++})
        `;
      }
      
      for (const t of problem.hidden_tests) {
        await sql`
          INSERT INTO test_cases (problem_id, input, expected_output, is_sample, ordinal)
          VALUES (${realProblemId}, ${JSON.stringify(t.input)}, ${JSON.stringify(t.expected_output)}, false, ${ordinal++})
        `;
      }

      console.log(`Imported ${problem.title} with signature ${signature.name}`);
      importedCount++;
    } catch (e) {
      console.error(`Error importing ${file}:`, e);
    }
  }

  console.log(`Total imported: ${importedCount}`);
  
  const [{ count: pCount }] = await sql`SELECT COUNT(*) FROM problems WHERE is_draft = false`;
  const [{ count: tCount }] = await sql`SELECT COUNT(*) FROM test_cases`;
  
  console.log(`Problems in DB (non-draft): ${pCount}`);
  console.log(`Total test cases in DB: ${tCount}`);

  process.exit(0);
}

main().catch(console.error);
