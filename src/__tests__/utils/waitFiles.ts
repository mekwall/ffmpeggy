import { FSWatcher, watch, promises } from "fs";
import { dirname, resolve as resolvePath } from "path";
const { stat } = promises;

function mapAsync<T, U>(
  array: T[],
  callbackfn: (value: T, index: number, array: T[]) => Promise<U>
): Promise<U[]> {
  return Promise.all(array.map(callbackfn));
}

async function filterAsync<T>(
  array: T[],
  callbackfn: (value: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
  const filterMap = await mapAsync(array, callbackfn);
  return array.filter((value, index) => filterMap[index]);
}

export async function waitFiles(
  rawFiles: string[],
  timeout = 10000
): Promise<void> {
  const files = rawFiles.map((f) => resolvePath(f));
  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;

  let count = 0;
  const dirsToWatch = (
    await filterAsync(files, async (f) => {
      try {
        const stats = await stat(f);
        if (stats.size > 0) {
          count++;

          return false;
        }
      } catch {
        // Ignore
      }
      return true;
    })
  ).map((f) => dirname(f));

  // We already got all the files so we can early out
  if (count === files.length) {
    return;
  }

  const promise = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Files did not show up before the timeout"));
    }, timeout);

    const runningStats = new Set<string>();
    for (const dir of dirsToWatch) {
      const watcher = watch(dir, { persistent: true });
      watcher.on("change", async (event, fileName) => {
        const fullPath = resolvePath(dir, fileName.toString());
        if (runningStats.has(fullPath)) {
          return;
        }
        try {
          runningStats.add(fullPath);
          const stats = await stat(fullPath);
          runningStats.delete(fullPath);
          if (count > rawFiles.length) {
            return;
          }
          if (stats.size > 0) {
            if (files.includes(fullPath)) {
              count++;
              if (count === rawFiles.length) {
                watcher.close();
                resolve();
              }
            }
          }
        } catch {
          // Ignore
        }
      });
    }
  });

  promise.finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
    for (const watcher of watchers) {
      watcher.close();
    }
  });

  return promise;
}
