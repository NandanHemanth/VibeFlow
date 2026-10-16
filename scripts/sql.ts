import { sql } from "../src/harness/surreal";
sql(process.argv[2]).then((r) => console.log(JSON.stringify(r).slice(0, 1500))).catch((e) => console.log("ERR", e.message));
