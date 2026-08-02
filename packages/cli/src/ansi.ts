/** ANSI helpers — no deps; respects NO_COLOR / FORCE_COLOR / non-TTY. */

export type Paint = (s: string) => string;

export type PaintKit = {
  reset: Paint;
  bold: Paint;
  dim: Paint;
  red: Paint;
  green: Paint;
  yellow: Paint;
  blue: Paint;
  magenta: Paint;
  cyan: Paint;
  gray: Paint;
  white: Paint;
};

export function useColor(stream: NodeJS.WriteStream = process.stderr): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== "") {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  if (process.env.FORCE_COLOR != null && process.env.FORCE_COLOR !== "") {
    return true;
  }
  return Boolean(stream.isTTY);
}

export function makePaint(enabled: boolean): PaintKit {
  const wrap =
    (open: string, close = "\u001b[0m"): Paint =>
    (s) =>
      enabled ? `${open}${s}${close}` : s;

  return {
    reset: wrap("\u001b[0m"),
    bold: wrap("\u001b[1m"),
    dim: wrap("\u001b[2m"),
    red: wrap("\u001b[31m"),
    green: wrap("\u001b[32m"),
    yellow: wrap("\u001b[33m"),
    blue: wrap("\u001b[34m"),
    magenta: wrap("\u001b[35m"),
    cyan: wrap("\u001b[36m"),
    gray: wrap("\u001b[90m"),
    white: wrap("\u001b[37m"),
  };
}
