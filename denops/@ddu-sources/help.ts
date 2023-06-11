import { BaseSource, Item, SourceOptions } from "https://deno.land/x/ddu_vim@v3.0.2/types.ts";
import { Denops, fn, op } from "https://deno.land/x/ddu_vim@v3.0.2/deps.ts";
import { dirname, join } from "https://deno.land/std@0.191.0/path/mod.ts";

import { ActionData } from "../@ddu-kinds/help.ts";

export type HelpInfo = {
  lang: string;
  path: string;
  pattern: string;
};

type Params = {
  style: "allLang" | "minimal";
  helpLang?: string;
};

export class Source extends BaseSource<Params> {
  kind = "help";

  gather(args: {
    denops: Denops;
    sourceParams: Params;
    sourceOptions: SourceOptions;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const langs = args.sourceParams.helpLang?.split(",") ??
          (await op.helplang.getGlobal(args.denops)).split(",");

        const rtp = await op.runtimepath.getGlobal(args.denops);
        const tagfiles = (await fn.globpath(args.denops, rtp, "doc/tags*"))
          .split("\n")
          .filter((tagfile) => /tags(?:-\w+)?$/.test(tagfile)); // Filter tagsrch.txt, etc.

        const tagMap: Record<string, HelpInfo[]> = {};
        await Promise.all(tagfiles.map(async (tagfile) => {
          const matched = tagfile.match(/tags-(\w+)$/);
          const lang = matched ? matched[1] : "en";
          const root = dirname(tagfile);

          const tagLines = (await Deno.readTextFile(tagfile)).split(/\r?\n/);
          tagLines.map((line) => {
            if (line.startsWith("!_TAG_FILE_ENCODING")) {
              return;
            }
            const segment = line.split(`\t`);
            if (segment.length < 3) {
              return;
            }

            const [tag, fname, _pattern] = segment;
            if (fname.endsWith(".md")) {
              // Lazy.nvim generates tags for markdown as well.
              return;
            }
            const path = join(root, fname);
            const pattern = _pattern.slice(1);

            if (!tagMap[tag]) {
              tagMap[tag] = [];
            }
            tagMap[tag].push({ lang, path, pattern });
          });
        }));

        const items = Object.entries(tagMap).flatMap(([tag, infos]) => {
          if (args.sourceParams.style === "minimal" || infos.length === 1) {
            return {
              word: tag,
              action: {
                word: tag,
                path: infos[0].path,
                pattern: infos[0].pattern,
              },
              data: infos[0].lang,
            };
          } else {
            return infos
              .filter((info) => langs.includes(info.lang))
              .map((info) => {
                const tagWithLang = `${tag}@${info.lang}`;
                return {
                  word: tagWithLang,
                  action: {
                    word: tagWithLang,
                    path: info.path,
                    pattern: info.pattern,
                  },
                  data: info.lang,
                };
              });
          }
        });

        controller.enqueue(items);
        controller.close();
      },
    });
  }

  params(): Params {
    return {
      style: "minimal",
    };
  }
}
