import { daytona } from "../src/harness/daytona";
(async () => { for await (const s of daytona().list() as AsyncIterable<any>) console.log(s.id, s.labels?.tool, s.state, s.cpu, s.memory, s.createdAt); })();
