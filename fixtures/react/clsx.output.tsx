import { clsx } from "clsx";
import { cn } from "./utils";

export function Btn( Cond: boolean) {
  return (
    <button
      className={cn(
        "w-10 p-4",
        Cond && "h-2.5",
        clsx({ "gap-2": Cond }),
      )}
    />
  );
}
