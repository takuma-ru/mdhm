import { defineConfig, steps, z } from "rlse.ts";
import type { RlseContext } from "rlse.ts";

const version = ({ results }: RlseContext) =>
  results.findStep<{ nextVersion: string }>("calculateNextSemver").nextVersion;

const tag = (context: RlseContext) => `v${version(context)}`;
const releaseBranch = steps.releaseBranchName({ version: tag });

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
    steps.resolvePackage({ name: "mdhm.cli" }),
    steps.resolvePublishedVersion({
      packageName: ({ results }: RlseContext) =>
        results.findStep<{ packageName: string }>("resolvePackage").packageName,
      fallbackVersion: ({ results }: RlseContext) =>
        results.findStep<{ packageJson: { version?: string } }>("resolvePackage").packageJson
          .version ?? "0.0.0",
    }),
    steps.calculateNextSemver({
      currentVersion: ({ results }: RlseContext) =>
        results.findStep<{ currentVersion: string }>("resolvePublishedVersion").currentVersion,
      packageJson: ({ results }: RlseContext) =>
        results.findStep<{ packageJson: Record<string, unknown> }>("resolvePackage").packageJson,
      level: args.level,
      pre: args.pre,
      ...(args.exactVersion ? { version: args.exactVersion } : {}),
    }),
    steps.createReleaseBranch({ branch: releaseBranch }),
    steps.writePackageVersion({
      packageJsonPath: ({ results }: RlseContext) =>
        results.findStep<{ packageJsonPath: string }>("resolvePackage").packageJsonPath,
      version,
    }),
    steps.runCommand("pnpm run test"),
    steps.stageFiles({
      paths: ({ results }: RlseContext) => [
        results.findStep<{ packageJsonPath: string }>("resolvePackage").packageJsonPath,
      ],
    }),
    steps.commit({
      message: "Release mdhm.cli",
      skipIfNoChanges: true,
    }),
    steps.checkNpmPackageVersionAvailable({
      packageName: ({ results }: RlseContext) =>
        results.findStep<{ packageName: string }>("resolvePackage").packageName,
      version,
    }),
    steps.publishNpmPackage({
      packageName: ({ results }: RlseContext) =>
        results.findStep<{ packageName: string }>("resolvePackage").packageName,
      packageDir: ({ results }: RlseContext) => {
        const packageJsonPath = results.findStep<{ packageJsonPath: string }>(
          "resolvePackage",
        ).packageJsonPath;

        return packageJsonPath.replace(/\/[^/]+$/, "");
      },
      dryRunVersion: version,
    }),
    steps.verifyPublishedNpmPackage({
      packageName: ({ results }: RlseContext) =>
        results.findStep<{ packageName: string }>("resolvePackage").packageName,
      version,
    }),
    steps.push({
      branch: releaseBranch,
      setUpstream: true,
    }),
    steps.tag({
      name: tag,
      message: (context) => `Release mdhm.cli ${version(context)}`,
    }),
    steps.pushTag({ tag }),
    steps.githubRelease({
      tag,
      title: (context) => `mdhm.cli ${version(context)}`,
      prerelease: ({ results }: RlseContext) =>
        results.findStep<{ pre: boolean }>("calculateNextSemver").pre,
    }),
  ],
});
