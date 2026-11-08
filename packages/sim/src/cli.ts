/** Command name -> handler. Later tasks (C3, C4) register their commands here. */
export const commands: Record<string, (args: string[]) => Promise<void> | void> = {};

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  const run = name === undefined ? undefined : commands[name];
  if (run === undefined) {
    console.error(`usage: pnpm sim <command> [options]\ncommands: ${Object.keys(commands).join(', ') || '(none yet)'}`);
    return name === undefined ? 0 : 1;
  }
  await run(rest);
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
