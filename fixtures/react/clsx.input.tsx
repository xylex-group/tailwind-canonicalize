import { clsx } from "clsx";
import { cn } from "./utils";

export function Btn( Cond: boolean) {
  return (
    <button
      className={cn(
        "w-[40px] p-[16px]",
        Cond && "h-[10px]",
        clsx({ "gap-[8px]": Cond }),
      )}
    />
  );
}
