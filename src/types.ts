export type Pref = "culture" | "nature" | "food" | "mixed";
export type Days = 1 | 2 | 3;
export type Outfit = "default" | "wuhan" | "community" | "travel" | "saig";

export interface Stop {
  when: string;
  place: string;
  text: string;
}

export interface DayPlan {
  label: string;
  stops: Stop[];
}

export interface Section {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  stops?: Stop[];
  days?: DayPlan[];
}

export interface Followup {
  label: string;
  query: string;
}

export interface Brief {
  paragraphs?: string[];
  bullets?: string[];
}

export interface Reply {
  lead: string;
  brief?: Brief;
  sections: Section[];
  caveat?: string;
  sources: string[];
  followups: Followup[];
  role?: Outfit;
}

export interface SightEntry {
  aliases: string[];
  reply: Reply;
}

export interface Itinerary {
  title: string;
  basis: string;
  lead: string;
  days: DayPlan[];
  tips: string[];
  caveat: string;
  sources: string[];
  followups: Followup[];
}

export interface Knowledge {
  meta: {
    name: string;
    site: string;
    contact: string;
    sources: { id: string; label: string; note: string }[];
  };
  replies: Record<string, Reply>;
  sights: SightEntry[];
  itineraries: Record<string, Itinerary>;
}
