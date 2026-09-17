async function main() {
    // Get daily problem
    const probRes = await fetch("http://localhost:4000/api/problems/ce076571-9bb5-4b86-bf25-4522b4924b28");
    const problem = await probRes.json();
    console.log("Submitting to problem:", problem.title, "ID:", problem.id);
    
    // Test Python
    let pyCode = `class Solution:\n    def ${problem.functionSignature.name}(self, **kwargs):\n        return [0, 1]`;
    console.log("Submit Python");
    const resPy = await fetch("http://localhost:4000/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyZGJkNzk2LTljODUtNGEwOS1iY2YyLWQzOWM0MWQ3MWQzNCIsImlhdCI6MTc4OTYyMTIyOX0.d-M7M6G902Afp3lO5qCASfp0-nZGr3qob3XGErgD154" },
        body: JSON.stringify({ problemId: problem.id, language: "python", code: pyCode, action: "submit" })
    });
    const dPy = await resPy.json();
    console.log("Python Submission ID:", dPy.submissionId);

    // Test C++
    let cppCode = problem.starterCode.cpp || problem.starterCode["c++"];
    cppCode = cppCode.replace('// TODO: implement', `return {0, 1};`);
    console.log("Submit C++");
    const resCpp = await fetch("http://localhost:4000/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyZGJkNzk2LTljODUtNGEwOS1iY2YyLWQzOWM0MWQ3MWQzNCIsImlhdCI6MTc4OTYyMTIyOX0.d-M7M6G902Afp3lO5qCASfp0-nZGr3qob3XGErgD154" },
        body: JSON.stringify({ problemId: problem.id, language: "cpp", code: cppCode, action: "submit" })
    });
    const dCpp = await resCpp.json();
    console.log("C++ Submission ID:", dCpp.submissionId);

    // Test Java
    let javaCode = problem.starterCode.java;
    javaCode = javaCode.replace('return null;', `return new int[]{0, 1};`);
    console.log("Submit Java");
    const resJava = await fetch("http://localhost:4000/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyZGJkNzk2LTljODUtNGEwOS1iY2YyLWQzOWM0MWQ3MWQzNCIsImlhdCI6MTc4OTYyMTIyOX0.d-M7M6G902Afp3lO5qCASfp0-nZGr3qob3XGErgD154" },
        body: JSON.stringify({ problemId: problem.id, language: "java", code: javaCode, action: "submit" })
    });
    const dJava = await resJava.json();
    console.log("Java Submission ID:", dJava.submissionId);

    async function poll(id) {
        while (true) {
            const pRes = await fetch(`http://localhost:4000/api/practice/submissions/${id}`, {
                headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyZGJkNzk2LTljODUtNGEwOS1iY2YyLWQzOWM0MWQ3MWQzNCIsImlhdCI6MTc4OTYyMTIyOX0.d-M7M6G902Afp3lO5qCASfp0-nZGr3qob3XGErgD154" }
            });
            const pData = await pRes.json();
            if (pData.status === 'completed' || pData.verdict !== 'pending') {
                console.log(`Verdict for ${id}:`, pData.verdict, pData.passedTests + '/' + pData.totalTests);
                if (pData.language === 'java') {
                   console.log("Java details:", JSON.stringify(pData.testResults, null, 2));
                }
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    await poll(dPy.submissionId);
    await poll(dCpp.submissionId);
    await poll(dJava.submissionId);
}
main();
