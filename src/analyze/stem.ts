// @ts-expect-error — snowball-stemmers has no type declarations
import { newStemmer } from "snowball-stemmers";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { platform, homedir } from "node:os";
import { existsSync, readdirSync } from "node:fs";
export type StemFunction = (word: string) => string;

export function createStemmer(type: "snowball" | "simplemma" | "none"): StemFunction {
  if (type === "none") {
    return (word: string) => word.toLowerCase();
  }

  if (type === "simplemma") {
    throw new Error("Use createBatchStemmer() for simplemma — call it after collecting all unique tokens");
  }

  const stemmer = newStemmer("german");
  return (word: string) => stemmer.stem(word.toLowerCase()) as string;
}

export interface BatchStemResult {
  stem: StemFunction;
  lemmaDisplayForms: Map<string, string>;
}

export function createBatchStemmer(uniqueTokens: string[], originalForms: Map<string, string>, language: string = "de"): BatchStemResult {
  const getPythonBase = (): { bin: string, args: string[] } => {
    const errors: string[] = [];
    
    // 1. Manually search PATH to avoid spawn ENOENT and WindowsApps issues
    if (platform() === "win32") {
      const pathEnv = process.env.PATH || "";
      const pathDirs = pathEnv.split(";");
      
      // GUI apps on Windows often lose the User PATH and only keep System PATH.
      // We explicitly inject the most common User-level Python installation directories.
      const home = homedir();
      const extraDirs = [
        join(home, "AppData", "Local", "Python", "bin"),
        join(home, "AppData", "Local", "Programs", "Python", "Launcher")
      ];
      
      // Also grab Python310, Python311, Python312 etc. from Programs\Python
      try {
        const programsPython = join(home, "AppData", "Local", "Programs", "Python");
        if (existsSync(programsPython)) {
          const subdirs = readdirSync(programsPython);
          for (const sub of subdirs) {
            extraDirs.push(join(programsPython, sub));
            extraDirs.push(join(programsPython, sub, "Scripts"));
          }
        }
      } catch (e) {}

      const allDirs = [...pathDirs, ...extraDirs];
      const exes = ["python.exe", "python3.exe", "py.exe"];
      
      for (const dir of allDirs) {
        if (!dir || dir.toLowerCase().includes("\\windowsapps")) continue;
        for (const exe of exes) {
          const fullPath = join(dir, exe);
          if (existsSync(fullPath)) {
            try {
              execFileSync(fullPath, ["-c", "import sys"], { stdio: "ignore" });
              return { bin: fullPath, args: [] };
            } catch (e: any) {
              errors.push(`Resolved '${fullPath}' failed: ${e.message}`);
            }
          }
        }
      }
    }

    // 2. Fallback to standard command names
    const commands = platform() === "win32" ? ["python", "py -3", "python3"] : ["python3", "python"];
    for (const cmd of commands) {
      try {
        const bin = cmd.split(" ")[0];
        const args = cmd.split(" ").slice(1);
        execFileSync(bin, [...args, "-c", "import sys"], { stdio: "ignore" });
        return { bin, args };
      } catch (e: any) {
        errors.push(`'${cmd}' failed: ${e.message}`);
      }
    }
    throw new Error(`Python 3 not found on system PATH.\nPATH details: ${(process.env.PATH || '').substring(0, 100)}...\nDetails:\n${errors.join("\n")}`);
  };

  const { bin: pyExecutable, args: pyArgs } = getPythonBase();

  // Auto-install simplemma if missing
  try {
    execFileSync(pyExecutable, [...pyArgs, "-c", "import simplemma"], { stdio: "ignore" });
  } catch (e) {
    console.log("  simplemma module not found. Installing via pip...");
    execFileSync(pyExecutable, [...pyArgs, "-m", "pip", "install", "simplemma"]);
  }

  const scriptPath = resolve("scripts/lemmatize.py");

  const tokensWithCap = uniqueTokens.filter((t) => {
    const orig = originalForms.get(t);
    return orig && orig[0] !== orig[0].toLowerCase();
  });
  const tokensLowerOnly = uniqueTokens.filter((t) => {
    const orig = originalForms.get(t);
    return !orig || orig[0] === orig[0].toLowerCase();
  });

  console.log(`  Lemmatizing ${uniqueTokens.length} unique tokens via simplemma...`);
  console.log(`    ${tokensWithCap.length} with capitalized original, ${tokensLowerOnly.length} lowercase-only`);

  const capInput = tokensWithCap.map((t) => originalForms.get(t) ?? t).join("\n") + "\n";
  const lowerInput = tokensLowerOnly.join("\n") + "\n";

  const runPython = (inputStr: string) => {
    return execFileSync(pyExecutable, [...pyArgs, scriptPath, language], { 
      input: inputStr, 
      encoding: "utf-8", 
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    }).toString().trim().split(/\r?\n/);
  };

  const capOutput = tokensWithCap.length > 0 ? runPython(capInput) : [];
  const lowerOutput = tokensLowerOnly.length > 0 ? runPython(lowerInput) : [];

  const lookupMap = new Map<string, string>();
  const lemmaDisplayForms = new Map<string, string>();

  for (let i = 0; i < tokensWithCap.length && i < capOutput.length; i++) {
    const parts = capOutput[i].split("\t");
    const stemKey = parts[0];
    const display = parts[1] ?? parts[0];
    lookupMap.set(tokensWithCap[i], stemKey);
    if (!lemmaDisplayForms.has(stemKey)) {
      lemmaDisplayForms.set(stemKey, display);
    }
  }

  for (let i = 0; i < tokensLowerOnly.length && i < lowerOutput.length; i++) {
    const parts = lowerOutput[i].split("\t");
    const stemKey = parts[0];
    const display = parts[1] ?? parts[0];
    lookupMap.set(tokensLowerOnly[i], stemKey);
    if (!lemmaDisplayForms.has(stemKey)) {
      lemmaDisplayForms.set(stemKey, display);
    }
  }
  console.log(`  Lemmatization complete: ${lookupMap.size} mappings`);

  const stem: StemFunction = (word: string) => {
    const lower = word.toLowerCase();
    return lookupMap.get(lower) ?? lower;
  };

  return { stem, lemmaDisplayForms };
}
