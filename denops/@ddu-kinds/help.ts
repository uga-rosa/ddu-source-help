import {
  ActionArguments,
  ActionFlags,
  BaseKind,
  DduItem,
  PreviewContext,
  Previewer,
} from "https://deno.land/x/ddu_vim@v3.0.2/types.ts";
import { Denops } from "https://deno.land/x/ddu_vim@v3.0.2/deps.ts";

export type ActionData = {
  word: string;
  path: string;
  pattern: string;
};

type OpenParams = {
  command: string;
};

type Params = Record<never, never>;

export class Kind extends BaseKind<Params> {
  contents?: Record<string, string[]>;

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

      const action = items[0]?.action as ActionData;
      await denops.cmd(`silent ${openCommand} help ${action.word}`);
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
    const path = action.path;

    if (!this.contents) {
      this.contents = {};
    }
    if (!this.contents[path]) {
      this.contents[path] = (await Deno.readTextFile(path)).split(/\r?\n/);
    }
    const lineNr = this.contents[path].findIndex((line) => line.includes(action.pattern)) + 1;

    const [start, end] = [lineNr, lineNr + args.previewContext.height];

    return {
      kind: "terminal",
      cmds: ["bat", "-n", path, "-r", `${start}:${end}`, "--highlight-line", "0"],
    };
  }

  params(): Params {
    return {};
  }
}
