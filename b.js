const path = require("path");

const basePath = "/a/b/c";
const basePath2 = "/a/b/c/";
const absolutePath = "/a/b/c/d/y.js";
const relationPath = "../c/d/y.js";

function toRelationPath(basePath, absolutePath) {
  return path.join(
    "..",
    path.basename(basePath),
    path.relative(basePath, absolutePath)
  );
}

function toAbsolutePath(basePath, relationPath) {
  return path.join(basePath, relationPath);
}

console.log(absolutePath === toAbsolutePath(basePath, relationPath));
console.log(absolutePath === toAbsolutePath(basePath2, relationPath));
console.log(relationPath === toRelationPath(basePath, absolutePath));
console.log(relationPath === toRelationPath(basePath2, absolutePath));

const root = {
  path: "..",
  name: path.basename(basePath),
};
const Desktop = {
  path: path.join(root.path, root.name),
  name: "Desktop",
  children: [],
};

Desktop.children.push({
  path: path.join(Desktop.path, Desktop.name),
  name: "文件夹",
  children: [],
});

console.log(root, Desktop);
