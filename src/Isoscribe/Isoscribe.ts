import { exhaustiveMatchGuard } from "ts-jolt/isomorphic";
import { c } from "./Colorize.js";

export type IsoScribeLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

export type IsoScribeAction =
  | IsoScribeLogLevel
  | "checkpoint:start"
  | "checkpoint:end"
  | "success"
  | "watch";

type IsoScribeLogFormat = "json" | "string";
type IsoScribeLogTarget = "browser" | "server";
type IsoScribeLogEnv = `${IsoScribeLogTarget}-${IsoScribeLogFormat}`;

const LOG_LEVEL_PRIORITY: Record<IsoScribeLogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const LOG_ACTION: Record<IsoScribeAction, string> = {
  trace: c.magenta(`● ${c.underline("trace")}`),
  debug: c.magenta(`● ${c.underline("debug")}`),
  info: c.blueBright(`ℹ︎ ${c.underline("info")}`),
  warn: c.yellowBright(`! ${c.underline("warn")}`),
  error: c.red(`✕ ${c.underline("error")}`),
  fatal: c.redBright(`✕ ${c.underline("fatal")}`),
  success: c.green(`✓ ${c.underline("success")}`),
  watch: c.cyan(`⦿ ${c.underline("watching")}`),
  "checkpoint:start": c.cyanBright(`➤ ${c.underline("checkpoint:start")}`),
  "checkpoint:end": c.cyanBright(`➤ ${c.underline("checkpoint:end")}`),
};
type LogAction = keyof typeof LOG_ACTION;

type IsoScribeOptions = {
  /**
   * A name that will be converted into camel case that describes
   * the logger that is being instantiated. This can be a feature
   * or a group of functionality th👀at you want to ensure has it's own
   * separate logger
   */
  name: string;
  /**
   * A hex value for the background color of the pill that
   * is logged to the console in the browser
   * @default #55daf0
   */
  pillColor?: string;
  /**
   * The default log level to be printed
   */
  logLevel?: IsoScribeLogLevel;
  /**
   * The format at which the log should
   * be printed
   */
  logFormat?: IsoScribeLogFormat;
};

export class Isoscribe {
  private _logLevel: IsoScribeLogLevel;
  private _logFormat: IsoScribeLogFormat;
  private _logLevelNameMaxLen: number;
  private _logPill: {
    text: string;
    css: string;
  };
  private _logName: string;

  constructor(args: IsoScribeOptions) {
    this._logLevel = args.logLevel ?? "info";
    this._logFormat = args.logFormat ?? "string";
    this._logName = args.name;
    this._logLevelNameMaxLen = Math.max(
      ...Object.keys(LOG_LEVEL_PRIORITY).map((l) => `[${l}]`.length)
    );
    this._logPill = {
      text: this._logName,
      css: this.getLogPillCss(args.pillColor ?? "#55daf0"),
    };
  }

  /** Set log level dynamically */
  set logLevel(level: IsoScribeLogLevel) {
    this._logLevel = level;
  }

  private shouldLog(level: IsoScribeLogLevel): boolean {
    const shouldLog =
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this._logLevel];
    return shouldLog;
  }

  private getLogEnv(): IsoScribeLogEnv {
    if (typeof window !== "undefined") {
      return `browser-${this._logFormat}`;
    }
    return `server-${this._logFormat}`;
  }

  /** Determines text color for contrast */
  private getLogPillCss(bgColor: string) {
    const rgb = Number.parseInt(bgColor.slice(1), 16);
    const [r, g, b] = [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
    const luminance = (ch: number) =>
      ch / 255 <= 0.03928 ? ch / 12.92 : ((ch + 0.055) / 1.055) ** 2.4;
    const textColor =
      0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b) >
      0.179
        ? "#000"
        : "#fff";

    const styles = {
      background: bgColor,
      color: textColor,
      ["font-weight"]: "bold",
      padding: "2px 6px",
      "border-radius": "4px",
    };
    const css = Object.entries(styles)
      .reduce<string[]>(
        (accum, [property, value]) => accum.concat(`${property}: ${value}`),
        []
      )
      .join("; ");

    return css;
  }

  /** Assigns a console logger to the log level */
  private getLogFn(level: IsoScribeLogLevel) {
    switch (level) {
      case "error":
      case "fatal":
        return console.error;

      case "warn":
        return console.warn;

      case "debug":
      case "info":
      case "trace":
        return console.log;

      default:
        return exhaustiveMatchGuard(level);
    }
  }

  /** Gets the formatted name of the logging event */
  private getLogLevelName(
    logLevel: IsoScribeLogLevel,
    options?: { setWidth?: boolean }
  ) {
    const css = "font-weight: bold";
    const name = logLevel.toUpperCase();
    if (!options?.setWidth) {
      return {
        name,
        css,
      };
    }
    return {
      name: `[${name}]`.padEnd(this._logLevelNameMaxLen),
      css,
    };
  }

  /** Get's and formats the timestamp of the logging event */
  private getLogTimestamp(options?: {
    format?: "iso" | "hh:mm:ss AM/PM";
  }): string {
    const format = options?.format ?? "iso";
    const now = new Date();
    switch (format) {
      case "iso":
        return now.toISOString();

      case "hh:mm:ss AM/PM":
        return new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(
          new Date()
        );

      default:
        exhaustiveMatchGuard(format);
    }
  }

  log(
    {
      level,
      message,
      action,
    }: { level: IsoScribeLogLevel; action?: LogAction; message: string },
    ...data: any[]
  ) {
    // Do nothing if the level shouldn't be logged
    if (!this.shouldLog(level)) return;

    const logger = this.getLogFn(level); // Get the logging function
    const env = this.getLogEnv(); // Get the environment to figure out _what_ to log

    // Log a message based upon the env
    switch (env) {
      case "browser-string": {
        const logPill = this._logPill;
        const logLevelName = this.getLogLevelName(level, { setWidth: true });
        const logTimestamp = this.getLogTimestamp({ format: "hh:mm:ss AM/PM" });
        const logMessage = c.gray(message);
        const logAction = action ? LOG_ACTION[action] : "";

        logger(
          `${logTimestamp} %c${logPill.text}, %c${logLevelName.name}`,
          logPill.css,
          logLevelName.css,
          logAction,
          logMessage,
          ...data
        );
        break;
      }

      case "server-string": {
        const logTimestamp = c.gray(
          this.getLogTimestamp({ format: "hh:mm:ss AM/PM" })
        );
        const logFeature = this._logName;
        const logAction = action ? LOG_ACTION[action] : "";
        const logMessage = c.gray(message);
        const logLevelName = this.getLogLevelName(level, { setWidth: true });
        const logStr = `${logTimestamp} ${logLevelName.name} ${logFeature} ${logAction} ${logMessage}`;
        if (data.length === 0) {
          return logger(logStr);
        }
        logger(logStr, data);
        break;
      }

      case "browser-json":
      case "server-json": {
        const logTimestamp = this.getLogTimestamp({ format: "iso" });
        const logFeature = this._logName;
        logger(
          JSON.stringify({
            timestamp: logTimestamp,
            feature: logFeature,
            level,
            message,
            data,
          })
        );
        break;
      }

      default:
        exhaustiveMatchGuard(env);
    }
  }

  trace(message: string, ...data: any[]) {
    this.log({ level: "trace", action: "trace", message }, ...data);
  }
  debug(message: string, ...data: any[]) {
    this.log({ level: "debug", action: "debug", message }, ...data);
  }
  info(message: string, ...data: any[]) {
    this.log({ level: "info", action: "info", message }, ...data);
  }
  warn(message: string, ...data: any[]) {
    this.log({ level: "warn", action: "warn", message }, ...data);
  }
  error(message: string, ...data: any[]) {
    this.log({ level: "error", action: "error", message }, ...data);
  }
  fatal(error: Error) {
    this.log({ level: "fatal", action: "fatal", message: error.message });
    // Print out the stack trace
    if (!this.shouldLog("fatal")) return;
    const logger = this.getLogFn("debug");
    logger(
      `
${c.gray((error.stack ?? "").replace(`Error: ${error.message}\n`, ""))}`
    );
  }
  // vanity methods
  success(message: string, ...data: any[]) {
    this.log({ level: "info", action: "success", message }, ...data);
  }
  watch(message: string, ...data: any[]) {
    this.log({ level: "info", action: "watch", message }, ...data);
  }
  checkpointStart() {
    this.log({ level: "debug", action: "checkpoint:start", message: "-- --" });
  }
  checkpointEnd() {
    this.log({ level: "debug", action: "checkpoint:end", message: "-- --" });
  }
}
