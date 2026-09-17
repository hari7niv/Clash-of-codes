
const fs = require('fs');


class Solution {
    addTwo(a, b) {
        return a + b;
    }
}


const inputStr = fs.readFileSync(0, 'utf-8');
if (inputStr.trim()) {
    const parsedInput = JSON.parse(inputStr);
    const args = ["a","b"].map(name => parsedInput[name]);
    let result;
    const solution = new Solution();
    result = solution.addTwo(...args);
    console.log(JSON.stringify(result));
}
