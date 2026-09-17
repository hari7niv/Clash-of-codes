import fs from 'fs';

export interface FunctionParameter {
  name: string;
  type: string;
}

export interface FunctionSignature {
  name: string;
  params: FunctionParameter[];
  returnType: string;
}

export function generatePythonHarness(userCode: string, signature: FunctionSignature): string {
  const hasSolutionClass = userCode.includes('class Solution');
  
  const callCode = hasSolutionClass 
    ? `solution = Solution()\n        result = solution.${signature.name}(**parsed_input)`
    : `result = ${signature.name}(**parsed_input)`;

  return `
import sys
import json
from typing import *

${userCode}

if __name__ == '__main__':
    input_str = sys.stdin.read()
    if input_str.strip():
        parsed_input = json.loads(input_str)
        ${callCode}
        print(json.dumps(result, separators=(',', ':')))
`;
}

export function generateJavaScriptHarness(userCode: string, signature: FunctionSignature): string {
  const hasSolutionClass = userCode.includes('class Solution');
  
  const callCode = hasSolutionClass
    ? `const solution = new Solution();\n    result = solution.${signature.name}(...args);`
    : `result = ${signature.name}(...args);`;

  return `
const fs = require('fs');

${userCode}

const inputStr = fs.readFileSync(0, 'utf-8');
if (inputStr.trim()) {
    const parsedInput = JSON.parse(inputStr);
    const args = ${JSON.stringify(signature.params.map(p => p.name))}.map(name => parsedInput[name]);
    let result;
    ${callCode}
    console.log(JSON.stringify(result));
}
`;
}

export function serializeForCppJava(inputJson: string, signature: FunctionSignature): string {
  const input = JSON.parse(inputJson);
  let result = '';

  const serializeValue = (val: any, type: string) => {
    if (type === 'int') {
      result += `${val}\n`;
    } else if (type === 'String') {
      result += `${Buffer.from(String(val), 'utf8').toString('hex')}\n`;
    } else if (type === 'boolean') {
      result += `${val ? 1 : 0}\n`;
    } else if (type === 'int[]' || type === 'double[]') {
      const arr = val as number[];
      result += `${arr.length}\n`;
      if (arr.length > 0) result += arr.join(' ') + '\n';
    } else if (type === 'String[]') {
      const arr = val as string[];
      result += `${arr.length}\n`;
      for (const s of arr) {
        result += `${Buffer.from(String(s), 'utf8').toString('hex')}\n`;
      }
    } else if (type === 'int[][]' || type === 'char[][]') {
      const arr = val as any[][];
      result += `${arr.length}\n`;
      for (const row of arr) {
        result += `${row.length}\n`;
        if (row.length > 0) result += row.join(' ') + '\n';
      }
    }
  };

  for (const p of signature.params) {
    serializeValue(input[p.name], p.type);
  }
  return result;
}

export function generateCppHarness(userCode: string, signature: FunctionSignature): string {
  let readers = '';
  let callArgs: string[] = [];
  
  let i = 0;
  for (const p of signature.params) {
    const varName = `arg${i++}`;
    callArgs.push(varName);
    if (p.type === 'int' || p.type === 'double') {
      readers += `    ${p.type} ${varName}; cin >> ${varName};\n`;
    } else if (p.type === 'char') {
      readers += `    char ${varName}; cin >> ${varName};\n`;
    } else if (p.type === 'String') {
      readers += `    string hex${i}; cin >> hex${i}; string ${varName} = hexDecode(hex${i});\n`;
    } else if (p.type === 'boolean') {
      readers += `    int b${i}; cin >> b${i}; bool ${varName} = (b${i} != 0);\n`;
    } else if (p.type === 'int[]' || p.type === 'double[]' || p.type === 'char[]') {
      const innerType = p.type.replace('[]', '');
      readers += `    int sz${i}; cin >> sz${i}; vector<${innerType}> ${varName}(sz${i}); for(int j=0; j<sz${i}; j++) cin >> ${varName}[j];\n`;
    } else if (p.type === 'String[]') {
      readers += `    int sz${i}; cin >> sz${i}; vector<string> ${varName}(sz${i}); for(int j=0; j<sz${i}; j++) { string h; cin >> h; ${varName}[j] = hexDecode(h); }\n`;
    } else if (p.type === 'int[][]' || p.type === 'char[][]' || p.type === 'double[][]') {
      const innerType = p.type.replace('[][]', '');
      readers += `    int rows${i}; cin >> rows${i}; vector<vector<${innerType}>> ${varName}(rows${i}); for(int r=0; r<rows${i}; r++) { int cols; cin >> cols; ${varName}[r].resize(cols); for(int c=0; c<cols; c++) cin >> ${varName}[r][c]; }\n`;
    }
  }

  let outFormat = '';
  if (signature.returnType === 'int' || signature.returnType === 'double') {
    outFormat = `cout << result << endl;`;
  } else if (signature.returnType === 'char') {
    outFormat = `cout << "\\"" << result << "\\"" << endl;`;
  } else if (signature.returnType === 'boolean') {
    outFormat = `cout << (result ? "true" : "false") << endl;`;
  } else if (signature.returnType === 'String') {
    outFormat = `cout << "\\"" << result << "\\"" << endl;`;
  } else if (signature.returnType === 'int[]' || signature.returnType === 'double[]') {
    outFormat = `cout << "["; for(int i=0; i<result.size(); i++) cout << result[i] << (i < result.size()-1 ? "," : ""); cout << "]" << endl;`;
  } else if (signature.returnType === 'char[]') {
    outFormat = `cout << "["; for(int i=0; i<result.size(); i++) cout << "\\"" << result[i] << "\\"" << (i < result.size()-1 ? "," : ""); cout << "]" << endl;`;
  } else if (signature.returnType === 'String[]') {
    outFormat = `cout << "["; for(int i=0; i<result.size(); i++) cout << "\\"" << result[i] << "\\"" << (i < result.size()-1 ? "," : ""); cout << "]" << endl;`;
  } else if (signature.returnType === 'int[][]' || signature.returnType === 'double[][]') {
    outFormat = `cout << "["; for(int r=0; r<result.size(); r++) { cout << "["; for(int c=0; c<result[r].size(); c++) cout << result[r][c] << (c < result[r].size()-1 ? "," : ""); cout << "]" << (r < result.size()-1 ? "," : ""); } cout << "]" << endl;`;
  } else if (signature.returnType === 'char[][]') {
    outFormat = `cout << "["; for(int r=0; r<result.size(); r++) { cout << "["; for(int c=0; c<result[r].size(); c++) cout << "\\"" << result[r][c] << "\\"" << (c < result[r].size()-1 ? "," : ""); cout << "]" << (r < result.size()-1 ? "," : ""); } cout << "]" << endl;`;
  }

  return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

string hexDecode(string str) {
    string ret;
    for (int i=0; i<str.length(); i+=2) {
        int ii;
        sscanf(str.substr(i, 2).c_str(), "%x", &ii);
        ret += static_cast<char>(ii);
    }
    return ret;
}

${userCode}

int main() {
${readers}
    Solution sol;
    auto result = sol.${signature.name}(${callArgs.join(', ')});
    ${outFormat}
    return 0;
}
`;
}

export function generateJavaHarness(userCode: string, signature: FunctionSignature): string {
  let readers = '';
  let callArgs: string[] = [];
  
  let i = 0;
  for (const p of signature.params) {
    const varName = `arg${i++}`;
    callArgs.push(varName);
    if (p.type === 'int' || p.type === 'double') {
      readers += `        ${p.type} ${varName} = sc.next${p.type === 'int' ? 'Int' : 'Double'}();\n`;
    } else if (p.type === 'char') {
      readers += `        char ${varName} = sc.next().charAt(0);\n`;
    } else if (p.type === 'String') {
      readers += `        String ${varName} = hexDecode(sc.next());\n`;
    } else if (p.type === 'boolean') {
      readers += `        int b${i} = sc.nextInt(); boolean ${varName} = (b${i} != 0);\n`;
    } else if (p.type === 'int[]' || p.type === 'double[]') {
      const innerType = p.type.replace('[]', '');
      readers += `        int sz${i} = sc.nextInt(); ${innerType}[] ${varName} = new ${innerType}[sz${i}]; for(int j=0; j<sz${i}; j++) ${varName}[j] = sc.next${innerType === 'int' ? 'Int' : 'Double'}();\n`;
    } else if (p.type === 'char[]') {
      readers += `        int sz${i} = sc.nextInt(); char[] ${varName} = new char[sz${i}]; for(int j=0; j<sz${i}; j++) ${varName}[j] = sc.next().charAt(0);\n`;
    } else if (p.type === 'String[]') {
      readers += `        int sz${i} = sc.nextInt(); String[] ${varName} = new String[sz${i}]; for(int j=0; j<sz${i}; j++) { ${varName}[j] = hexDecode(sc.next()); }\n`;
    } else if (p.type === 'int[][]' || p.type === 'double[][]') {
      const innerType = p.type.replace('[][]', '');
      readers += `        int rows${i} = sc.nextInt(); ${innerType}[][] ${varName} = new ${innerType}[rows${i}][]; for(int r=0; r<rows${i}; r++) { int cols = sc.nextInt(); ${varName}[r] = new ${innerType}[cols]; for(int c=0; c<cols; c++) ${varName}[r][c] = sc.next${innerType === 'int' ? 'Int' : 'Double'}(); }\n`;
    } else if (p.type === 'char[][]') {
      readers += `        int rows${i} = sc.nextInt(); char[][] ${varName} = new char[rows${i}][]; for(int r=0; r<rows${i}; r++) { int cols = sc.nextInt(); ${varName}[r] = new char[cols]; for(int c=0; c<cols; c++) ${varName}[r][c] = sc.next().charAt(0); }\n`;
    }
  }

  let outFormat = '';
  if (signature.returnType === 'int' || signature.returnType === 'double') {
    outFormat = `System.out.println(result);`;
  } else if (signature.returnType === 'char') {
    outFormat = `System.out.println("\\"" + result + "\\"");`;
  } else if (signature.returnType === 'boolean') {
    outFormat = `System.out.println(result ? "true" : "false");`;
  } else if (signature.returnType === 'String') {
    outFormat = `System.out.println("\\"" + result + "\\"");`;
  } else if (signature.returnType === 'int[]' || signature.returnType === 'double[]') {
    outFormat = `System.out.print("["); for(int i=0; i<result.length; i++) System.out.print(result[i] + (i < result.length-1 ? "," : "")); System.out.println("]");`;
  } else if (signature.returnType === 'char[]') {
    outFormat = `System.out.print("["); for(int i=0; i<result.length; i++) System.out.print("\\"" + result[i] + "\\"" + (i < result.length-1 ? "," : "")); System.out.println("]");`;
  } else if (signature.returnType === 'String[]') {
    outFormat = `System.out.print("["); for(int i=0; i<result.length; i++) System.out.print("\\"" + result[i] + "\\"" + (i < result.length-1 ? "," : "")); System.out.println("]");`;
  } else if (signature.returnType === 'int[][]' || signature.returnType === 'double[][]') {
    outFormat = `System.out.print("["); for(int r=0; r<result.length; r++) { System.out.print("["); for(int c=0; c<result[r].length; c++) System.out.print(result[r][c] + (c < result[r].length-1 ? "," : "")); System.out.print("]" + (r < result.length-1 ? "," : "")); } System.out.println("]");`;
  } else if (signature.returnType === 'char[][]') {
    outFormat = `System.out.print("["); for(int r=0; r<result.length; r++) { System.out.print("["); for(int c=0; c<result[r].length; c++) System.out.print("\\"" + result[r][c] + "\\"" + (c < result[r].length-1 ? "," : "")); System.out.print("]" + (r < result.length-1 ? "," : "")); } System.out.println("]");`;
  }

  return `
import java.util.*;
import java.io.*;

${userCode}

public class Main {
    public static String hexDecode(String hex) {
        if (hex.length() == 0) return "";
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        }
        return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
    }

    public static void main(String[] args) throws Exception {
        Scanner sc = new Scanner(System.in);
${readers}
        Solution sol = new Solution();
        var result = sol.${signature.name}(${callArgs.join(', ')});
        ${outFormat}
    }
}
`;
}
