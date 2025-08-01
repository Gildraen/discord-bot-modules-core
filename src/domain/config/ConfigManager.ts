import fs from "fs";
import path from "path";
import { ConfigSchema, type ConfigType, type ModuleConfigType } from "./ConfigSchema.js";

const CONFIG_PATH = path.resolve(process.cwd(), ".dbmrc.json");

export class ConfigManager {
    private config: ConfigType;

    public constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): ConfigType {
        if (!fs.existsSync(CONFIG_PATH)) {
            throw new Error("Missing configuration file: .dbmrc.json");
        }

        let rawData: string;
        try {
            rawData = fs.readFileSync(CONFIG_PATH, "utf-8");
        } catch {
            throw new Error("Unreadable configuration file");
        }

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(rawData);
        } catch {
            throw new Error("Invalid JSON in configuration file");
        }

        try {
            return ConfigSchema.parse(parsedJson);
        } catch {
            throw new Error("Invalid configuration structure");
        }
    }

    public getModuleConfig(moduleName: string): ModuleConfigType {
        if (!Object.hasOwn(this.config, moduleName)) {
            throw new Error(`Module config for "${moduleName}" not found.`);
        }
        return this.config[moduleName];
    }

    public getConfig(): ConfigType {
        return this.config;
    }

    public getEnabledModules(): Array<{ name: string; config: ModuleConfigType }> {
        return Object.entries(this.config)
            .filter(([, cfg]) => cfg.enabled)
            .map(([name, cfg]) => ({ name, config: cfg }));
    }
}