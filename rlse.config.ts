import { defineConfig, presets, steps, z } from "rlse.ts";
import type { RlseContext } from "rlse.ts";

const version = ({ results }: RlseContext) =>
  results.findStep<{ nextVersion: string }>("calculateNextSemver").nextVersion;

const tag = (context: RlseContext) => `v${version(context)}`;

export default defineConfig({
  args: z.object({
    level: z
      .enum(["patch", "minor", "major", "preup", "fix"])
      .default("patch")
      .describe("Release level"),
    pre: z.boolean().default(false).describe("Release as a pre-release"),
    exactVersion: z.string().optional().describe("Release an exact version"),
  }),
  flow: ({ args }) => [
    steps.checkCleanWorkingTree(),
    steps.checkGitHubAuth(),
    steps.checkNpmToken(),
    ...presets.npmRelease({
      resolvePackage: { name: "mdhm" },
      calculateNextSemver: {
        level: args.level,
        pre: args.pre,
        ...(args.exactVersion ? { version: args.exactVersion } : {}),
      },
      runCommand: "pnpm run test",
      commit: {
        message: "Release mdhm",
        skipIfNoChanges: true,
      },
      push: {
        branch: "main",
      },
    }),
    steps.tag({
      name: tag,
      message: (context) => `Release mdhm ${version(context)}`,
    }),
    steps.pushTag({ tag }),
    steps.githubRelease({
      tag,
      title: (context) => `mdhm ${version(context)}`,
      prerelease: ({ results }: RlseContext) =>
        results.findStep<{ pre: boolean }>("calculateNextSemver").pre,
    }),
  ],
});
