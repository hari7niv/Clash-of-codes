
import sys
import json
from typing import *


class Solution:
    def addTwo(self, a: int, b: int) -> int:
        return a + b


if __name__ == '__main__':
    input_str = sys.stdin.read()
    if input_str.strip():
        parsed_input = json.loads(input_str)
        solution = Solution()
        result = solution.addTwo(**parsed_input)
        print(json.dumps(result, separators=(',', ':')))
