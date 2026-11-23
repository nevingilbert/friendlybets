import { describe, expect, it } from "vitest";

import { decodeCopyField, parseCopyBlocks, shapeImport } from "../scripts/lib/supabase-dump.mjs";

describe("decodeCopyField", () => {
  it("reads NULL and plain text", () => {
    expect(decodeCopyField("\\N")).toBeNull();
    expect(decodeCopyField("A shot")).toBe("A shot");
  });

  it("decodes COPY escapes", () => {
    expect(decodeCopyField("a\\tb\\nc\\\\d")).toBe("a\tb\nc\\d");
    expect(decodeCopyField("\\101\\x42")).toBe("AB");
  });

  it("leaves non-ASCII text alone", () => {
    expect(decodeCopyField("Zoë — “quoted”")).toBe("Zoë — “quoted”");
  });
});

describe("parseCopyBlocks", () => {
  const dump = [
    'COPY "public"."profiles" (id, display_name, avatar_url, created_at) FROM stdin;',
    "u1\tAna\t\\N\t2026-08-20 10:00:00+00",
    "\\.",
    "COPY public.ignored (x) FROM stdin;",
    "nope",
    "\\.",
    "COPY auth.identities (provider_id, user_id, identity_data, provider) FROM stdin;",
    'g-1\tu1\t{"sub":"g-1"}\tgoogle',
    "\\.",
  ].join("\n");

  it("collects only the wanted tables, quoted names included", () => {
    const tables = parseCopyBlocks(dump, ["public.profiles", "auth.identities"]);
    expect(Object.keys(tables).sort()).toEqual(["auth.identities", "public.profiles"]);
    expect(tables["public.profiles"]).toEqual([
      { id: "u1", display_name: "Ana", avatar_url: null, created_at: "2026-08-20 10:00:00+00" },
    ]);
  });

  it("joins a profile to its Google identity", () => {
    const shaped = shapeImport(parseCopyBlocks(dump, ["public.profiles", "auth.identities"]));
    expect(shaped.users[0].google_sub).toBe("g-1");
    expect(shaped.unmatched).toEqual([]);
  });
});
