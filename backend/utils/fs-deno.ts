/**
 * Deno-specific file system utilities for compiled binaries
 * Uses Deno APIs to access embedded virtual filesystem
 */

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const data = await Deno.readFile(path);
  return data;
}

export async function readTextFile(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}
