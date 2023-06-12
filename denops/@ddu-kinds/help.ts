import {
  ActionArguments,
  ActionFlags,
  BaseKind,
  DduItem,
  PreviewContext,
  Previewer,
} from "https://deno.land/x/ddu_vim@v3.0.2/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v3.0.2/deps.ts";

export type ActionData = {
  path: string;
  pattern: string;
};

type OpenParams = {
  command: string;
};

type Params = Record<never, never>;

export class Kind extends BaseKind<Params> {
  override actions: Record<
    string,
    (args: ActionArguments<Params>) => Promise<ActionFlags>
  > = {
    open: async ({
      denops,
      actionParams,
      items,
    }: ActionArguments<Params>) => {
      const params = actionParams as OpenParams;
      // Convert sp[lit], vs[plit] tabe[dit] -> "vertical", "", "tab"
      const openCommand = (params.command ?? "").replace(
        /^vs(?:p(?:l(?:i(?:t)?)?)?)?$/,
        "vertical",
      ).replace(
        /^s(?:p(?:l(?:i(?:t)?)?)?)?$/,
        "",
      ).replace(
        /^tabe(?:d(?:i(?:t?)?)?)?$/,
        "tab",
      );

      await denops.cmd(`silent ${openCommand} help ${items[0].word}`);
      return ActionFlags.None;
    },
    vsplit: (args: ActionArguments<Params>) => {
      return this.actions["open"]({
        ...args,
        actionParams: { command: "vertical" },
      });
    },
    tabopen: (args: ActionArguments<Params>) => {
      return this.actions["open"]({
        ...args,
        actionParams: { command: "tab" },
      });
    },
  };

  override async getPreviewer(args: {
    denops: Denops;
    item: DduItem;
    previewContext: PreviewContext;
  }): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action || !action.path) {
      return;
    }
    const { denops, previewContext } = args;

    const command = await new Deno.Command("rg", {
      args: ["-n", "-F", action.pattern, action.path],
      stdin: "null",
      stdout: "piped",
    }).output();
    const lineNr = Number(decode(command.stdout).replace(/:.*/, ""));

    if (isNaN(lineNr) || lineNr < 1) {
      return {
        kind: "nofile",
        contents: [
          "Error",
          `No matches for ${action.pattern} in ${action.path}`,
        ],
      };
    }

    const [start, end] = [lineNr, lineNr + previewContext.height];

    const bufnr = await fn.bufadd(denops, action.path);
    await fn.bufload(denops, bufnr);

    const lines = await fn.getbufline(denops, bufnr, start, end);

    return {
      kind: "nofile",
      contents: lines,
      lineNr: 1,
      syntax: "help",
    };
  }

  params(): Params {
    return {};
  }
}

const DECODER = new TextDecoder();
function decode(u: Uint8Array) {
  return DECODER.decode(u);
}
