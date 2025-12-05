const fs = require("fs");
const { join, extname } = require("path");

const wasmFiles = [
  "pv_eagle_simd.wasm",
  "pv_eagle_simd.js",
  "pv_eagle_pthread.wasm",
  "pv_eagle_pthread.js",
]

console.log("Copying the WASM model...");

const sourceDirectory = join(
  __dirname,
  "..",
  "..",
  "..",
  "lib",
  "wasm"
);

const outputDirectory = join(__dirname, "..", "src", "lib");

try {
  fs.mkdirSync(outputDirectory, { recursive: true });
  wasmFiles.forEach(file => {
    fs.copyFileSync(join(sourceDirectory, file), join(outputDirectory, file))
    const ext = extname(file);
    if (ext === ".js") {
      fs.copyFileSync(join(sourceDirectory, file), join(outputDirectory, file.replace(ext, ".txt")));
    }
  })
} catch (error) {
  console.error(error);
}

console.log("... Done!");