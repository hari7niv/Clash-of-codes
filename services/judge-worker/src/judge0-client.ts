import axios, { AxiosError } from "axios";



interface Judge0Submission {
  language_id: number;
  source_code: string;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
  enable_network?: boolean;
}

interface Judge0Result {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  status: {
    id: number;
    description: string;
  };
  time?: string;
  memory?: number;
}

export class Judge0Client {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.JUDGE0_URL || "http://localhost:2358";
    this.apiKey = apiKey || process.env.JUDGE0_API_KEY || "";
  }

  async submit(submission: Judge0Submission): Promise<{ token: string }> {
    try {
      let memoryLimit = submission.memory_limit;
      if (submission.language_id === 63 || submission.language_id === 74) {
        // Node.js (63) and TypeScript (74) reserve virtual address space upfront for V8 CodeRange
        memoryLimit = Math.max(memoryLimit || 0, 2097152);
      } else if (submission.language_id === 62) {
        // Java (62) reserves Metaspace and heap
        memoryLimit = Math.max(memoryLimit || 0, 4096000);
      }

      const payload = {
        enable_network: false,
        enable_per_process_and_thread_time_limit: true,
        enable_per_process_and_thread_memory_limit: true,
        max_processes_and_or_threads: submission.language_id === 62 ? 120 : 64,
        compiler_options: submission.language_id === 62 ? "-J-Xmx256m -J-Xms256m" : undefined,
        run_options: submission.language_id === 62 ? "-Xmx256m -Xms256m" : undefined,
        ...submission,
        source_code: submission.source_code ? Buffer.from(submission.source_code).toString('base64') : undefined,
        stdin: submission.stdin ? Buffer.from(submission.stdin).toString('base64') : undefined,
        expected_output: submission.expected_output ? Buffer.from(submission.expected_output).toString('base64') : undefined,
        memory_limit: memoryLimit,
      };

      console.log("[Judge0 Client] Submitting to Judge0:");
      console.log(`  - Language ID: ${payload.language_id}`);
      console.log(`  - Source code length: ${payload.source_code?.length || 0} chars`);
      console.log(`  - Stdin length: ${payload.stdin?.length || 0} chars`);
      console.log(`  - Expected output length: ${payload.expected_output?.length || 0} chars`);
      console.log(`  - CPU time limit: ${payload.cpu_time_limit}s`);
      console.log(`  - Memory limit: ${payload.memory_limit}KB`);

      const response = await axios.post(`${this.baseUrl}/submissions`, payload, {
        params: {
          base64_encoded: true,
          wait: false, // Don't wait for result, we'll poll
        },
        headers: {
          "X-Auth-Token": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      console.log(`[Judge0 Client] Submission successful, token: ${response.data.token}`);
      return { token: response.data.token };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error("[Judge0 Client] Submission failed:");
      console.error(`  - Status: ${axiosError.response?.status}`);
      console.error(`  - Message: ${axiosError.message}`);
      console.error(`  - Response data:`, axiosError.response?.data);
      throw new Error(
        `Failed to submit to Judge0: ${axiosError.message} (Status: ${axiosError.response?.status})`
      );
    }
  }

  async getResult(token: string): Promise<Judge0Result> {
    try {
      const response = await axios.get(`${this.baseUrl}/submissions/${token}`, {
        params: {
          base64_encoded: true,
        },
        headers: {
          "X-Auth-Token": this.apiKey,
        },
      });

      const data = response.data;
      if (data.stdout) data.stdout = Buffer.from(data.stdout, 'base64').toString('utf8');
      if (data.stderr) data.stderr = Buffer.from(data.stderr, 'base64').toString('utf8');
      if (data.compile_output) data.compile_output = Buffer.from(data.compile_output, 'base64').toString('utf8');

      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error("[Judge0 Client] Get result failed:");
      console.error(`  - Token: ${token}`);
      console.error(`  - Status: ${axiosError.response?.status}`);
      console.error(`  - Message: ${axiosError.message}`);
      throw new Error(
        `Failed to get result from Judge0: ${axiosError.message} (Status: ${axiosError.response?.status})`
      );
    }
  }

  /**
   * Poll for result with exponential backoff
   * Status IDs: 1=In Queue, 2=Processing, 3+=Done
   */
  async pollResult(
    token: string,
    maxWaitMs = 30000,
    initialDelayMs = 200
  ): Promise<Judge0Result> {
    const startTime = Date.now();
    let delayMs = initialDelayMs;
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      pollCount++;
      const result = await this.getResult(token);

      console.log(`[Judge0 Client] Poll #${pollCount} for token ${token}:`);
      console.log(`  - Status ID: ${result.status.id}`);
      console.log(`  - Status description: ${result.status.description}`);

      // Status ID 1 = In Queue, 2 = Processing, 3+ = Done
      if (result.status.id >= 3) {
        console.log(`[Judge0 Client] Execution completed:`);
        console.log(`  - Stdout length: ${result.stdout?.length || 0} chars`);
        console.log(`  - Stderr length: ${result.stderr?.length || 0} chars`);
        console.log(`  - Compile output length: ${result.compile_output?.length || 0} chars`);
        console.log(`  - Time: ${result.time || 'N/A'}`);
        console.log(`  - Memory: ${result.memory || 'N/A'} KB`);
        
        if (result.stderr) {
          console.log(`[Judge0 Client] Stderr: ${result.stderr.substring(0, 200)}`);
        }
        if (result.compile_output) {
          console.log(`[Judge0 Client] Compile output: ${result.compile_output.substring(0, 200)}`);
        }
        
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 1000); // Exponential backoff, max 1s
    }

    console.error(`[Judge0 Client] Timeout after ${pollCount} polls and ${maxWaitMs}ms`);
    throw new Error(`Timeout waiting for Judge0 result after ${maxWaitMs}ms`);
  }
}
