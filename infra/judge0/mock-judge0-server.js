/**
 * MOCK JUDGE0 SERVER FOR WINDOWS DEVELOPMENT
 * 
 * This is a minimal Judge0-compatible API that runs on port 2359 (to avoid conflict).
 * It simulates code execution without actual sandboxing, allowing end-to-end testing
 * on Windows where real Judge0 cannot work due to cgroup limitations.
 * 
 * PRODUCTION: Use real Judge0 on Linux!
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 2359;
const submissions = new Map();

// Supported languages (subset)
const LANGUAGES = {
  71: { name: 'Python (3.8.1)', cmd: 'python', ext: 'py' },
  63: { name: 'JavaScript (Node.js 12.14.0)', cmd: 'node', ext: 'js' },
  50: { name: 'C (GCC 9.2.0)', cmd: 'gcc', ext: 'c', compile: true },
  54: { name: 'C++ (GCC 9.2.0)', cmd: 'g++', ext: 'cpp', compile: true },
  62: { name: 'Java (OpenJDK 13.0.1)', cmd: 'javac', ext: 'java', compile: true },
  74: { name: 'TypeScript', cmd: 'node --experimental-strip-types', ext: 'ts' },
};

function generateToken() {
  return crypto.randomUUID();
}

function decodeBase64(str, encoded) {
  if (!encoded || encoded === 'false') return str;
  return Buffer.from(str, 'base64').toString('utf-8');
}

function executeCode(languageId, sourceCode, stdin, callback) {
  const lang = LANGUAGES[languageId];
  if (!lang) {
    return callback({ status: { id: 13, description: 'Internal Error' }, message: 'Unsupported language' });
  }

  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const filename = `${generateToken()}.${lang.ext}`;
  const filepath = path.join(tempDir, filename);
  
  fs.writeFileSync(filepath, sourceCode);

  const startTime = Date.now();
  let command;

  if (lang.compile) {
    // Compilation not fully implemented in mock - just simulate success
    const elapsed = (Date.now() - startTime) / 1000;
    return callback({
      stdout: '',
      stderr: '',
      compile_output: null,
      message: null,
      time: elapsed.toFixed(3),
      memory: 3000,
      status: { id: 3, description: 'Accepted' }
    });
  } else {
    // Interpreted languages
    command = `${lang.cmd} "${filepath}"`;
  }

  exec(command, { input: stdin, timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    fs.unlinkSync(filepath);
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (error) {
      if (error.killed) {
        return callback({
          stdout: stdout || null,
          stderr: stderr || null,
          compile_output: null,
          message: 'Time Limit Exceeded',
          time: '5.000',
          memory: null,
          status: { id: 5, description: 'Time Limit Exceeded' }
        });
      }
      return callback({
        stdout: stdout || null,
        stderr: stderr || null,
        compile_output: null,
        message: error.message,
        time: elapsed.toFixed(3),
        memory: null,
        status: { id: 11, description: 'Runtime Error (NZEC)' }
      });
    }

    callback({
      stdout: stdout || null,
      stderr: stderr || null,
      compile_output: null,
      message: null,
      time: elapsed.toFixed(3),
      memory: 3000,
      status: { id: 3, description: 'Accepted' }
    });
  });
}

// GET /about
app.get('/about', (req, res) => {
  res.json({
    version: '1.13.1-mock',
    homepage: 'https://judge0.com',
    source_code: 'https://github.com/judge0/judge0',
    maintainer: 'Mock Judge0 for Windows Development'
  });
});

// POST /submissions
app.post('/submissions', (req, res) => {
  const {
    source_code,
    language_id,
    stdin = '',
    expected_output = null,
    base64_encoded = false
  } = req.body;

  const wait = req.query.wait === 'true';
  const token = generateToken();

  const decodedSource = decodeBase64(source_code, base64_encoded);
  const decodedStdin = decodeBase64(stdin, base64_encoded);

  const submission = {
    token,
    status: { id: 1, description: 'In Queue' }
  };

  submissions.set(token, submission);

  if (wait) {
    // Execute immediately
    executeCode(language_id, decodedSource, decodedStdin, (result) => {
      submission.status = result.status;
      submission.stdout = result.stdout;
      submission.stderr = result.stderr;
      submission.time = result.time;
      submission.memory = result.memory;
      submission.message = result.message;
      submission.compile_output = result.compile_output;
      res.status(201).json(submission);
    });
  } else {
    // Async: return token immediately, execute in background
    res.status(201).json(submission);
    setTimeout(() => {
      executeCode(language_id, decodedSource, decodedStdin, (result) => {
        submission.status = result.status;
        submission.stdout = result.stdout;
        submission.stderr = result.stderr;
        submission.time = result.time;
        submission.memory = result.memory;
        submission.message = result.message;
        submission.compile_output = result.compile_output;
      });
    }, 100);
  }
});

// GET /submissions/:token
app.get('/submissions/:token', (req, res) => {
  const submission = submissions.get(req.params.token);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  res.json(submission);
});

app.listen(PORT, () => {
  console.log(`🎭 Mock Judge0 Server listening on port ${PORT}`);
  console.log(`⚠️  WARNING: This is a DEVELOPMENT MOCK - use real Judge0 on Linux for production!`);
});
