import { getLeaderboard } from "../services/api/src/repositories/user.repo.ts";
import { getFriends } from "../services/api/src/repositories/user.repo.ts";

async function testQuery() {
  try {
    const res = await getLeaderboard({});
    console.log("Leaderboard:", res.total);
    
    // const f = await getFriends("dummy-id");
    console.log("All good!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
testQuery();
