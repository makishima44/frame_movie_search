import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "dist");
const tmdbApiKey = process.env.TMDB_API_KEY?.trim();

if (!tmdbApiKey) {
  throw new Error("TMDB_API_KEY must be set in the deployment environment.");
}

// Формируем чистую статическую папку для публикации, не меняя исходники проекта.
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(resolve(projectRoot, "index.html"), resolve(outputDirectory, "index.html"));
await cp(resolve(projectRoot, "style.css"), resolve(outputDirectory, "style.css"));
await cp(resolve(projectRoot, "src"), resolve(outputDirectory, "src"), { recursive: true });

// Клиентский TMDB API key будет виден в браузере: TMDB использует его в запросах сайта.
const generatedConfig = `export const TMDB_API_KEY = ${JSON.stringify(tmdbApiKey)};\n`;
await writeFile(resolve(outputDirectory, "src", "config.js"), generatedConfig, "utf8");
