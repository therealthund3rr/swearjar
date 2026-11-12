// Canned utterances for `?demo=1` and the video. Each line is typed into the normal utterance pipeline.
export type DemoLine = { delayMs: number; text: string; lang: "en-US" | "it-IT" };

export const DEMO_SCRIPT: DemoLine[] = [
  { delayMs: 3000, text: "Okay team, we are doing great, hold the mid lane.", lang: "en-US" },
  { delayMs: 4000, text: "Oh shit, he flanked us from behind!", lang: "en-US" }, // real swear
  { delayMs: 4000, text: "Fun fact: the word 'cazzo' actually comes from Latin.", lang: "en-US" }, // mention: must not be fined
  { delayMs: 4000, text: "Porco d*** ho perso di nuovo!", lang: "it-IT" }, // dodge: fined
  { delayMs: 3500, text: "Mortacci tua, ma che hai fatto?", lang: "it-IT" }, // dialect: fined
  { delayMs: 4000, text: "Beh, quella è stata una bella cazzata, ammettiamolo.", lang: "it-IT" }, // borderline: usually goes to a vote
  { delayMs: 3500, text: "Oh cavolo, mannaggia, quasi ce l'avevamo fatta.", lang: "it-IT" }, // free words
  { delayMs: 4000, text: "Good game everyone, same time tomorrow?", lang: "en-US" },
];
