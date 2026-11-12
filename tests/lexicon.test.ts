import { describe, expect, it } from "vitest";
import { LEXICON_SIZE, lexiconScan, maskWord, normalizeText } from "@/lib/lexicon";
import { defaultRuleSet } from "@/lib/rules";

const rules = defaultRuleSet(1000);
const roots = (t: string, r = rules) => lexiconScan(t, r).map((h) => h.normalized);

describe("normalizeText", () => {
  it("lowercases and strips accents", () => expect(normalizeText("Perché CAFFÈ")).toBe("perche caffe"));
  it("maps leetspeak", () => expect(normalizeText("p0rc0 $h1t @ss 7")).toBe("porco shit ass t"));
  it("collapses 3+ repeats", () => expect(normalizeText("cazzzzo fuuuck")).toBe("cazo fuck"));
  it("keeps double letters and asterisks", () => expect(normalizeText("cazzo c***o")).toBe("cazzo c***o"));
});

describe("maskWord", () => {
  it("keeps first and last letter", () => {
    expect(maskWord("cazzo")).toBe("c***o");
    expect(maskWord("porco dio")).toBe("p*******o");
  });
  it("short words become a single star", () => {
    expect(maskWord("ok")).toBe("*");
    expect(maskWord("a")).toBe("*");
  });
});

describe("lexiconScan", () => {
  it("has about 80 roots", () => expect(LEXICON_SIZE).toBeGreaterThanOrEqual(75));

  it("finds plain words with the exact original quote", () => {
    const [h] = lexiconScan("Che CAZZO fai?", rules);
    expect(h).toMatchObject({ quote: "CAZZO", normalized: "cazzo", tier_id: "strong", is_mention: false, confidence: 0.8, alternative: "cavolo" });
  });

  it("handles repeats, leetspeak and accents", () => {
    expect(roots("cazzzzo")).toEqual(["cazzo"]);
    expect(roots("m3rd4")).toEqual(["merda"]);
    expect(roots("p0rc0 d10")).toEqual(["porco dio"]);
  });

  it("treats asterisks as wildcards", () => {
    expect(roots("che c***o dici")).toEqual(["cazzo"]);
    expect(roots("what the f***")).toEqual(["fuck"]);
    expect(roots("f***ing hell")).toEqual(["fuck"]);
    const [h] = lexiconScan("p0rc0 d** ho perso", rules);
    expect(h).toMatchObject({ normalized: "porco dio", tier_id: "blasphemy", quote: "p0rc0 d**" });
  });

  it("catches multi-word blasphemy and dodges", () => {
    expect(roots("dio cane")).toEqual(["dio cane"]);
    expect(roots("porca madonna")).toEqual(["porca madonna"]);
    expect(roots("madonna puttana")).toEqual(["madonna puttana"]);
    expect(roots("porco d")).toEqual(["porco d"]);
    expect(roots("dio c")).toEqual(["dio c"]);
  });

  it("does not treat an elided d' / c' as a dodge", () => {
    expect(roots("porco d'un cane")).toEqual([]);
    expect(roots("dio c'è")).toEqual([]);
  });

  it("uses word boundaries", () => {
    expect(roots("a classic assistant")).toEqual([]);
    expect(roots("che scazzottata")).toEqual([]);
    expect(roots("what an ass")).toEqual(["ass"]);
    expect(roots("stronzata")).toEqual(["stronzo"]);
    expect(roots("strong stronger")).toEqual([]);
  });

  it("never fines free words", () => {
    expect(roots("cavolo mannaggia accidenti porca miseria fudge shoot darn gosh heck")).toEqual([]);
  });

  it("respects free_terms from the rules", () => {
    expect(roots("che palle", { ...rules, free_terms: ["palle"] })).toEqual([]);
    expect(roots("che palle")).toEqual(["palle"]);
  });

  it("maps slurs to the slur tier and EN/IT regional words to tiers", () => {
    expect(lexiconScan("faggot", rules)[0].tier_id).toBe("slur");
    expect(lexiconScan("sticazzi", rules)[0].tier_id).toBe("strong");
    expect(lexiconScan("damn", rules)[0].tier_id).toBe("mild");
    expect(lexiconScan("mortacci tua", rules)[0].normalized).toBe("mortacci");
  });

  it("finds several hits in one sentence", () => {
    expect(roots("shit, cazzo e dio cane")).toEqual(["shit", "cazzo", "dio cane"]);
  });
});
