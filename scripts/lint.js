const fs = require("node:fs");
const path = require("node:path");

const roots = ["app.js", "core-v08.js", "data-sources-v08.js", "index.html", "styles.css", "README.md", "docs", "tests"];
const files = [];
function collect(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) collect(path.join(target, entry));
  } else files.push(target);
}
for (const root of roots) collect(root);

const failures = [];
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${file}:${index + 1} trailing whitespace`);
    if (line.includes("\t")) failures.push(`${file}:${index + 1} tab character`);
  });
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Style checks passed for ${files.length} files.`);
