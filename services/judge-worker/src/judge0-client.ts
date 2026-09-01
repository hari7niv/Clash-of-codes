import axios, { AxiosError } from "axios";

const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";

interface Judge0Submission {
  language_id: number;
  source_code: string;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
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

  constructor(baseUrl = JUDGE0_URL, apiKey = JUDGE0_API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async submit(submission: Judge0Submission): Promise<{ token: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/submissions`, submission, {
        params: {
          base64_encoded: false,
          wait: false, // Don't wait for result, we'll poll
        },
        headers: {
          "X-Auth-Token": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      return { token: response.data.token };
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `Failed to submit to Judge0: ${axiosError.message} (Status: ${axiosError.response?.status})`
      );
    }
  }

  async getResult(token: string): Promise<Judge0Result> {
    try {
      const response = await axios.get(`${this.baseUrl}/submissions/${token}`, {
        params: {
          base64_encoded: false,
        },
        headers: {
          "X-Auth-Token": this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
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

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getResult(token);

      // Status ID 1 = In Queue, 2 = Processing, 3+ = Done
      if (result.status.id >= 3) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 1000); // Exponential backoff, max 1s
    }

    throw new Error(`Timeout waiting for Judge0 result after ${maxWaitMs}ms`);
  }
}
