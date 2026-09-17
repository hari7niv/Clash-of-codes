import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

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

function mapTypeToPython(t: string): string {
  switch (t) {
    case 'int': return 'int';
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

function generatePythonStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => `${p.name}: ${mapTypeToPython(p.type)}`).join(', ');
  const retType = mapTypeToPython(sig.returnType);
  return `from typing import *\n\nclass Solution:\n    def ${sig.name}(self, ${params}) -> ${retType}:\n        # TODO: implement\n        pass\n`;
}

function generateJSStarter(sig: FunctionSignature): string {
  const params = sig.params.map(p => p.name).join(', ');
  return `class Solution {\n    ${sig.name}(${params}) {\n        // TODO: implement\n        return null;\n    }\n}\n`;
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
  const problems = await sql`SELECT id, function_signature FROM problems`;
  console.log(`Found ${problems.length} problems.`);

  for (const p of problems) {
    if (p.function_signature) {
      const sig = p.function_signature as FunctionSignature;
      const starterCode = {
        python: generatePythonStarter(sig),
        javascript: generateJSStarter(sig),
        js: generateJSStarter(sig),
        python3: generatePythonStarter(sig),
        java: generateJavaStarter(sig),
        cpp: generateCppStarter(sig),
        "c++": generateCppStarter(sig)
      };

      await sql`UPDATE problems SET starter_code = ${starterCode} WHERE id = ${p.id}`;
    }
  }

  console.log("Done updating starter_code for Java and C++.");
  process.exit(0);
}

main().catch(console.error);
