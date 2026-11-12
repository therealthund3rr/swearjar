// Canned utterances for `?demo=1` and the video. Each line is typed into the normal utterance pipeline.
export type DemoLine = { delayMs: number; text: string; lang: "en-US" };

export const DEMO_SCRIPT: DemoLine[] = [
  { delayMs: 3000, text: "Okay team, we are doing great, hold the mid lane.", lang: "en-US" },
  { delayMs: 4000, text: "Oh shit, he flanked us from behind!", lang: "en-US" }, // real swear
  { delayMs: 4000, text: "Fun fact: the word fuck probably comes from an old Germanic verb.", lang: "en-US" }, // mention: must not be fined
  { delayMs: 4000, text: "Holy f*** I lost again!", lang: "en-US" }, // asterisk dodge from speech recognition: fined
  { delayMs: 3500, text: "What the actual sh1t was that?", lang: "en-US" }, // leetspeak dodge: fined
  { delayMs: 4000, text: "Well, that was a pretty crappy move, admit it.", lang: "en-US" }, // borderline: usually goes to a vote
  { delayMs: 3500, text: "Oh fudge, shoot, we almost had it.", lang: "en-US" }, // free euphemisms
  { delayMs: 4000, text: "Good game everyone, same time tomorrow?", lang: "en-US" },
];
