import knowledge from "../src/data/knowledge.json" with { type: "json" };
import { answer, replyPlainText } from "../src/engine.ts";
import type { Knowledge } from "../src/types.ts";

const kb = knowledge as Knowledge;
const cases: { query: string; must: string[]; ban?: string[] }[] = [
  { query: "请介绍武汉", must: ["江城", "敢为人先", "黄鹤楼公园", "1232.65", "武汉概览"] },
  { query: "请介绍数命SPU社区", must: ["智民里", "光谷创新天地", "8000", "BIWEN", "FDE", "OPC", "数命SPU社区说明"] },
  { query: "请说明什么是数命SPU", must: ["Super Person Unit", "超级个体单元", "独立判断", "U = PS", "11人", "400多次"] },
  {
    query: "请介绍数命SPU以及SAIG比赛",
    must: ["Super Person Unit", "独立判断", "48小时", "100万美元", "2026年12月18日", "四项", "developer@markyin.com"]
  },
  { query: "请介绍SAIG比赛", must: ["11月20日", "12月20日12:00", "湖北、湖南、江西、河北、台湾", "报名顺延中"] },
  { query: "官网和大赛说明的赛程有什么不一样", must: ["48小时", "16小时", "108", "40%", "平和打包厂", "不把它们加成两百万"] },
  { query: "请按1天、偏好人文规划武汉行程", must: ["江汉揽胜", "黄鹤楼", "70元", "1.6公里", "2026旅游手册"] },
  { query: "请按1天、偏好自然规划武汉行程", must: ["听涛", "101.98", "磨山"] },
  { query: "请按1天、偏好美食规划武汉行程", must: ["户部巷", "石记石太婆", "吉庆", "不编"] },
  { query: "请按1天、偏好综合规划武汉行程", must: ["6号线", "琴台站", "户部巷"] },
  { query: "请按2天、偏好人文规划武汉行程", must: ["湖北省博物馆", "提前3–7天", "凌波门", "楚河汉街"] },
  { query: "请按2天、偏好自然规划武汉行程", must: ["木兰天池", "70元", "车程"] },
  { query: "请按3天、偏好综合规划武汉行程", must: ["地铁三日游", "江汉关", "万松园", "空轨"] },
  { query: "请按3天、偏好美食规划武汉行程", must: ["兰陵路", "万松园", "下午4点多"] },
  { query: "介绍黄鹤楼的地址、门票和开放时间", must: ["蛇山西山坡特1号", "51.4", "70元", "17:00"] },
  { query: "介绍江汉关", must: ["1924", "需预约", "现场登记"] },
  { query: "武汉人口和经济", must: ["15616.06", "下降4.7%", "2020", "1400"] },
  { query: "BIWEN是什么", must: ["32个主体", "400多次"] },
  { query: "半天怎么玩", must: ["半天"] },
  { query: "帮我规划两天，想看博物馆和黄鹤楼", must: ["黄鹤楼", "湖北省博物馆"] },
  { query: "火星上的餐厅怎么订", must: ["对不上"] },
  { query: "怎么联系主办方", must: ["developer@markyin.com", "https://www.dlife.love/saig/"] },
  {
    query: "现在还能报名吗",
    must: ["11月20日", "11月23日", "报名顺延中", "报名继续开放", "截止时间以赛事公告为准", "developer@markyin.com"]
  },
  {
    query: "报名截止了吗",
    must: ["11月20日", "报名顺延中", "报名继续开放", "截止时间以赛事公告为准"]
  },
  {
    query: "报名顺延了吗",
    must: ["11月20日", "报名顺延中", "报名继续开放", "截止时间以赛事公告为准"]
  },
  {
    query: "入围名单公布了吗",
    must: ["11月23日", "报名顺延中", "developer@markyin.com"]
  },
  { query: "什么是FDE", must: ["FDE", "交付", "以订单养才", "数命SPU社区说明"] },
  { query: "什么是OPC", must: ["OPC", "一人公司", "数命SPU社区说明"] },
  {
    query: "月薪1万美元是真的吗",
    must: ["岗位探索设想", "1万美元", "不是"],
    ban: ["录取通知已经", "已经录用"]
  },
  {
    query: "武汉有哪些5A景区",
    must: ["黄鹤楼公园", "东湖风景名胜区", "湖北省博物馆", "木兰", "武汉概览"]
  },
  {
    query: "点赞截止了吗",
    must: ["2026年11月20日23:59:59", "北京时间", "人气榜"],
    ban: ["11月23日23:59"]
  },
  {
    query: "人气榜还能点赞吗",
    must: ["2026年11月20日23:59:59", "北京时间"]
  },
  {
    query: "我想玩四天怎么安排",
    must: ["1天、2天或3天", "2026旅游手册"],
    ban: ["你还没说几天"]
  },
  {
    query: "请按4天、偏好综合规划武汉行程",
    must: ["1天、2天或3天"],
    ban: ["你还没说几天"]
  }
];

let failed = 0;
for (const item of cases) {
  const text = replyPlainText(answer(kb, item.query));
  const missing = item.must.filter((part) => !text.includes(part));
  const banned = (item.ban ?? []).filter((part) => text.includes(part));
  if (missing.length || banned.length) {
    failed += 1;
    console.error("FAIL", item.query, { missing, banned });
  } else {
    console.log("ok", item.query);
  }
}

const keys = Object.keys(kb.itineraries);
if (keys.length !== 12) {
  failed += 1;
  console.error("itinerary count", keys.length);
}
for (const reply of Object.values(kb.replies)) {
  const blob = replyPlainText(reply);
  if (/lorem|欢迎来到你的应用|TODO/i.test(blob)) {
    failed += 1;
    console.error("placeholder in reply", reply.lead);
  }
}

if (failed) {
  console.error(`${failed} checks failed`);
  process.exit(1);
}
console.log(`all ${cases.length} replies matched`);
