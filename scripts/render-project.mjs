import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import path from "node:path";
import { renderExplicitProject } from "../src/generators/project.js";

try {
  const { values } = parseArgs({ options: {
    input: { type: "string" }, "out-dir": { type: "string" }, help: { type: "boolean" },
  } });
  if (values.help) {
    console.log("npm run render -- --input song.json --out-dir output/new-song\n明示的な音符JSONから song.chifu.json / song.svp / timeline.json / report.json を出力します。出力先は新しいフォルダーを指定してください。");
  } else {
    if (!values.input || !values["out-dir"]) throw new Error("--input と --out-dir を指定してください（--help で使い方を表示）。");
    const rendered = renderExplicitProject(JSON.parse(await readFile(values.input, "utf8")), path.basename(values["out-dir"]));
    const out = path.resolve(values["out-dir"]);
    // Exclusive directory creation protects previous renders and source files.
    await mkdir(path.dirname(out), { recursive: true });
    await mkdir(out);
    for (const [file, content] of [
      ["song.chifu.json", JSON.stringify(rendered.project, null, 2)], ["song.svp", rendered.svp],
      ["timeline.json", JSON.stringify(rendered.timeline, null, 2)], ["report.json", JSON.stringify(rendered.summary, null, 2)],
    ]) await writeFile(path.join(out, file), content + "\n", { flag: "wx" });
    console.log(JSON.stringify({ output: out, ...rendered.summary }, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
