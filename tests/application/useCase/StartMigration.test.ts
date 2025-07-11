import { describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import StartMigration from "app/application/useCase/StartMigration.js";
import { config } from "app/domain/config/Config.js";
import { loadModule } from "app/domain/module/ModuleLoader.js";
import type { MigrationReport } from "app/domain/types/MigrationReport.js";

vi.mock("app/domain/module/ModuleLoader.js", () => ({
    loadModule: vi.fn(),
}));

vi.mock("app/domain/config/Config.js", () => {
    return {
        config: {
            getEnabledModules: vi.fn(),
        },
    };
});

describe("StartMigration", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    test("runs migrate() on a single module in dryRun mode", async () => {
        const mockModule = { name: "test-module", migrate: vi.fn() };

        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "test-module", config: { enabled: true, settings: {} } },
        ]);

        (loadModule as Mock).mockResolvedValue(mockModule);

        const migration = new StartMigration(true); // dryRun: true
        const report = await migration.execute();

        expect(report.results).toEqual([
            { moduleName: "test-module", status: "success" },
        ]);
        expect(mockModule.migrate).not.toHaveBeenCalled();
    });

    test("executes real migration and records duration", async () => {
        const mockMigrate = vi.fn().mockResolvedValue(undefined);
        const mockModule = { name: "test-module", migrate: mockMigrate };

        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "test-module", config: { enabled: true, settings: {} } },
        ]);

        (loadModule as Mock).mockResolvedValue(mockModule);

        const migration = new StartMigration(false);
        const report = await migration.execute();

        expect(mockMigrate).toHaveBeenCalled();
        expect(report.results[0].status).toBe("success");
        expect(report.results[0]).toHaveProperty("durationMs");
    });

    test("handles error during module load", async () => {
        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "broken-module", config: {} },
        ]);

        (loadModule as Mock).mockRejectedValue(new Error("boom"));

        const migration = new StartMigration();
        const report = await migration.execute();

        expect(report.results[0].status).toBe("failed");
        expect(report.results[0].error).toMatch(/boom/);
    });

    test("handles error during module migration", async () => {
        const mockModule = { name: "error-module", migrate: vi.fn(() => { throw new Error("💥 migration error") }) };

        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "error-module", config: {} },
        ]);

        (loadModule as Mock).mockResolvedValue(mockModule);

        const migration = new StartMigration();
        const report = await migration.execute();

        expect(report.results[0]).toEqual({
            moduleName: "error-module",
            status: "failed",
            error: "💥 migration error",
        });
    });

    test("generates a full snapshot report with mixed results", async () => {
        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "mod-ok", config: {} },
            { name: "mod-fail", config: {} },
        ]);

        (loadModule as Mock)
            .mockResolvedValueOnce({ name: "mod-ok", migrate: vi.fn() })
            .mockResolvedValueOnce({ name: "mod-fail", migrate: vi.fn(() => { throw new Error("💥 fail") }) })

        const start = new StartMigration(false);
        const report: MigrationReport = await start.execute();

        expect(report).toMatchObject({
            results: [
                {
                    moduleName: "mod-ok",
                    status: "success",
                    durationMs: expect.any(Number) as number,
                },
                {
                    moduleName: "mod-fail",
                    status: "failed",
                    error: "💥 fail",
                },
            ],
            successCount: 1,
            failureCount: 1,
            totalDurationMs: expect.any(Number) as number,
        });
    });

    test("handles empty module list gracefully", async () => {
        (config.getEnabledModules as Mock).mockReturnValue([]);

        const migration = new StartMigration();
        const report = await migration.execute();

        expect(report.results).toEqual([]);
        expect(report.successCount).toBe(0);
        expect(report.failureCount).toBe(0);
        expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    test("handles modules with no configuration", async () => {
        const mockModule = { name: "no-config-module", migrate: vi.fn() };

        (config.getEnabledModules as Mock).mockReturnValue([
            { name: "no-config-module" },
        ]);

        (loadModule as Mock).mockResolvedValue(mockModule);

        const migration = new StartMigration();
        const report = await migration.execute();

        expect(report.results[0]).toEqual({
            moduleName: "no-config-module",
            status: "success",
            durationMs: expect.any(Number) as number,
        });
    });
});
