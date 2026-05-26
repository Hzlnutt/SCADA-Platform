export type TagValue = {
  tagId: string;
  value: number | string | boolean;
  ts: number;
  quality?: "good" | "bad" | "uncertain";
};

export type AlarmState = "active" | "ack" | "cleared";
