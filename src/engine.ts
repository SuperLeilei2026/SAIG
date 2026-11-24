import type { Days, Itinerary, Knowledge, Outfit, Pref, Reply } from "./types";

const PREF_LABEL: Record<Pref, string> = {
  culture: "人文",
  nature: "自然",
  food: "美食",
  mixed: "综合"
};

type DayGuess = Days | "half" | "long";

function tagged(reply: Reply, role: Outfit): Reply {
  return { ...reply, role };
}

export function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;；：:「」"'“”‘’（）()【】[\]·\-—～~]/g, "");
}

export function itineraryReply(kb: Knowledge, days: Days, pref: Pref): Reply {
  const key = `${days}-${pref}`;
  const item = kb.itineraries[key];
  if (!item) {
    return tagged(kb.replies.unknown, "default");
  }
  return fromItinerary(item);
}

function fromItinerary(item: Itinerary): Reply {
  return tagged({
    lead: item.lead,
    sections: [
      {
        heading: item.title,
        paragraphs: [`依据：${item.basis}`],
        days: item.days
      },
      {
        heading: "出发前",
        bullets: item.tips
      }
    ],
    caveat: item.caveat,
    sources: item.sources,
    followups: item.followups,
    role: "travel"
  }, "travel");
}

function detectDays(raw: string, norm: string): DayGuess | undefined {
  if (/半天|半日/.test(raw) || norm.includes("半天") || norm.includes("半日")) return "half";
  if (isLongTrip(raw, norm)) return "long";
  if (/三天|3天|三日|三日游/.test(raw) || /3日游/.test(norm)) return 3;
  if (/两天|二天|2天|两日|二日/.test(raw)) return 2;
  if (/一天|1天|一日/.test(raw) && !/十一/.test(raw)) return 1;
  return undefined;
}

function isLongTrip(raw: string, norm: string): boolean {
  if (/四天|四日|五天|五日|六天|六日|七天|七日|八天|八日|九天|九日|十天|十日|一周|两周|多天|好几天|更多天/.test(raw)) {
    return true;
  }
  // Only treat Arabic numerals with 天 as trip length, so calendar dates like 11月20日 are not a "20-day" trip.
  const numbered = [...norm.matchAll(/(?<!\d)(\d+)天/g)];
  if (numbered.some((match) => Number.parseInt(match[1], 10) >= 4)) return true;
  return /(?<!\d)([4-9]|[1-9]\d+)日游/.test(norm);
}

function detectPref(norm: string): Pref | undefined {
  const food = /美食|好吃|过早|宵夜|热干面|户部巷|吉庆|小吃|吃什么|吃喝/.test(norm);
  const nature = /自然|东湖|绿道|木兰|湖|骑行|湿地|看花|赏花/.test(norm);
  const culture = /人文|博物馆|历史|黄鹤楼|省博|江汉关|首义|红色|武大|武汉大学|古德寺/.test(norm);
  const mixed = /综合|都想|随便|混合|经典/.test(norm);
  const hits = [food, nature, culture].filter(Boolean).length;
  if (mixed || hits > 1) return "mixed";
  if (food) return "food";
  if (nature && !culture) return "nature";
  if (culture) return "culture";
  return undefined;
}

function matchSight(kb: Knowledge, norm: string) {
  let best: { alias: string; reply: Reply } | undefined;
  for (const sight of kb.sights) {
    for (const alias of sight.aliases) {
      const key = normalize(alias);
      if (key && norm.includes(key) && (!best || key.length > best.alias.length)) {
        best = { alias: key, reply: sight.reply };
      }
    }
  }
  return best;
}

function mentionsSalary(norm: string): boolean {
  if (/月薪|一万美元|一万美金|岗位探索设想/.test(norm)) return true;
  return /(?:^|\D)1万美元|(?:^|\D)10000美元/.test(norm);
}

export function answer(kb: Knowledge, raw: string): Reply {
  const text = raw.trim();
  const norm = normalize(text);
  if (!norm) return tagged(kb.replies.empty, "default");

  if (norm.includes("请介绍武汉")) return tagged(kb.replies.wuhan, "wuhan");
  if (norm.includes("请介绍数命spu社区")) return tagged(kb.replies.community, "community");
  if (norm.includes("请介绍数命spu以及saig")) return tagged(kb.replies.spuSaig, "saig");
  if (norm.includes("请说明什么是数命spu")) return tagged(kb.replies.spu, "saig");
  if (norm.includes("请介绍saig")) return tagged(kb.replies.saig, "saig");

  const planned = text.match(/请按\s*([123])\s*天[、,\s]*偏好\s*(人文|自然|美食|综合)/);
  if (planned) {
    const days = Number(planned[1]) as Days;
    const pref = ({ 人文: "culture", 自然: "nature", 美食: "food", 综合: "mixed" } as const)[planned[2] as "人文" | "自然" | "美食" | "综合"];
    return itineraryReply(kb, days, pref);
  }

  if (/人口|gdp|经济|院士|建城区|土地面积|常住人口/.test(norm)) return tagged(kb.replies.stats, "wuhan");
  if (/气候|天气|热不热|冷不冷/.test(norm)) return tagged(kb.replies.climate, "wuhan");
  if (/还能报名|还可以报名|现在报名|还在报名|报名截止|截止报名|报名顺延|报名继续|报名开放|入围名单|入围公布|公布入围|名单公布/.test(norm)) {
    return tagged(kb.replies.registrationStatus, "saig");
  }
  if (/点赞|人气榜|人气统计/.test(norm)) return tagged(kb.replies.popularityCutoff, "saig");
  if (mentionsSalary(norm)) return tagged(kb.replies.salary, "saig");
  if (/5a|五a级|国家5a|哪些5a|5a景区|五a景区/.test(norm)) return tagged(kb.replies.fiveA, "wuhan");
  if (/官网和大赛说明|两套赛程|赛程有什么不一样|说明和官网/.test(norm)) return tagged(kb.replies.saigSiteDiff, "saig");
  if (/biwen|毕文/.test(norm)) return tagged(kb.replies.biwen, "community");
  if (/(^|[^a-z])fde([^a-z]|$)/.test(norm)) return tagged(kb.replies.fde, "community");
  if (/(^|[^a-z])opc([^a-z]|$)|一人公司/.test(norm)) return tagged(kb.replies.opc, "community");
  if (/邮箱|怎么联系|联系方式|电话|官网/.test(norm)) return tagged(kb.replies.contact, "saig");

  const wantsPlan = /行程|规划|路线|日游|攻略|怎么玩|怎么逛|安排|好玩|值得去|去哪/.test(norm);
  const wantsFact = /门票|票价|开放|几点|地址|在哪|预约|介绍|是什么|怎么样/.test(norm);
  const sight = matchSight(kb, norm);

  if (sight && wantsFact && !wantsPlan) return tagged(sight.reply, "wuhan");
  if (sight && !wantsPlan && norm.length < 24) return tagged(sight.reply, "wuhan");

  const days = detectDays(text, norm);
  if (days === "half") return tagged(kb.replies.halfDay, "travel");
  if (days === "long") return tagged(kb.replies.longTrip, "travel");

  const mentionsCommunity = /社区|智民里|创新天地|8000|以订单养才/.test(norm);
  const mentionsSpu = /超级个体|superperson|什么是spu|spu是|五项|u=ps|ups/.test(norm) || (norm.includes("spu") && !mentionsCommunity);
  const mentionsSaig = /saig|大赛|比赛|黑客松|报名|线下赛|108|奖池|赛程/.test(norm);

  if (mentionsCommunity && !wantsPlan && !mentionsSaig) return tagged(kb.replies.community, "community");
  if (/四项功能|接待员必须/.test(norm)) return tagged(kb.replies.spuSaig, "saig");
  if (mentionsSpu && mentionsSaig) return tagged(kb.replies.spuSaig, "saig");
  if (mentionsSaig && !wantsPlan) return tagged(kb.replies.saig, "saig");
  if (mentionsSpu && !wantsPlan) return tagged(kb.replies.spu, "saig");

  if (/美食|好吃|热干面|过早|吃什么|小吃/.test(norm) && !wantsPlan && !days) return tagged(kb.replies.food, "wuhan");

  if (wantsPlan || days) {
    const pref = detectPref(norm) ?? (sight ? prefFromSight(sight.alias) : "mixed");
    const useDays: Days = days ?? 1;
    const reply = itineraryReply(kb, useDays, pref);
    if (!days) {
      return {
        ...reply,
        lead: `你还没说几天。我先按 1 天、${PREF_LABEL[pref]} 给你一版，可以改成 2 天或 3 天。${reply.lead}`,
        followups: [
          { label: "改成两天", query: `请按2天、偏好${PREF_LABEL[pref]}规划武汉行程` },
          { label: "改成三天", query: `请按3天、偏好${PREF_LABEL[pref]}规划武汉行程` },
          ...reply.followups
        ]
      };
    }
    return reply;
  }

  if (sight) return tagged(sight.reply, "wuhan");

  if (/^(你好|您好|嗨|哈喽|在吗|hello|hi|你是谁|介绍一下你自己)/.test(norm) || norm.length <= 4 && /你好|您好/.test(norm)) {
    return tagged(kb.replies.greeting, "default");
  }

  if (/武汉/.test(norm) && /介绍|概况|怎么样|是哪|什么样|历史/.test(norm)) return tagged(kb.replies.wuhan, "wuhan");

  return tagged(kb.replies.unknown, "default");
}

function prefFromSight(alias: string): Pref {
  if (/户部|热干|吉庆|美食/.test(alias)) return "food";
  if (/东湖|木兰|绿道|空轨/.test(alias)) return "nature";
  if (/黄鹤|江汉关|省博|博物馆|长江大桥|武大|大学|知音/.test(alias)) return "culture";
  return "mixed";
}

export function replyPlainText(reply: Reply): string {
  const parts = [reply.lead];
  for (const section of reply.sections) {
    if (section.heading) parts.push(section.heading);
    for (const p of section.paragraphs ?? []) parts.push(p);
    for (const b of section.bullets ?? []) parts.push(b);
    for (const stop of section.stops ?? []) parts.push(`${stop.when} ${stop.place} ${stop.text}`);
    for (const day of section.days ?? []) {
      parts.push(day.label);
      for (const stop of day.stops) parts.push(`${stop.when} ${stop.place} ${stop.text}`);
    }
  }
  if (reply.caveat) parts.push(reply.caveat);
  parts.push(reply.sources.join(" "));
  return parts.join("\n");
}
