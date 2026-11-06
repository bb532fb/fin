import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { DISCLAIMER, RISK_RULES, SIGNAL_THRESHOLDS } from "@/lib/config/trading";

export const metadata: Metadata = { title: "Մասին" };

const SECTIONS = [
  {
    title: "Ինչպես է աշխատում վերլուծությունը",
    body: "Ընտրված զույգի և ժամանակաշրջանի համար Binance-ից վերցվում են վերջին փակված candle-ները։ Հաշվարկվում են RSI, EMA 20/50/200, MACD, ATR, volume փոփոխություն և support/resistance մակարդակներ։ Կանոնների վրա հիմնված engine-ը գնահատում է աճային ու անկումային պայմանները, ստուգում է ավելի բարձր ժամանակաշրջանի trend-ը և որոշում է ՎԵՐԵՎ, ՆԵՐՔԵՎ կամ ԳՈՐԾԱՐՔ ՉԿԱ։",
  },
  {
    title: "Ինչ է նշանակում confidence և Setup որակը",
    body: "Signal confidence-ը (0–100) չափում է, թե որքան են indicator-ները համաձայն։ Setup A/B/C-ն ցույց է տալիս ընդհանուր որակը՝ confidence, R/R, կառուցվածքային մակարդակներ և բարձր timeframe համաձայնություն։ Սա setup-ի ուժի գնահատում է, ոչ շահույթի հավանականություն։",
  },
  {
    title: "Ինչու հաճախ է «ԳՈՐԾԱՐՔ ՉԿԱ»",
    body: `Engine-ը նախընտրում է դուրս մնալ։ ԳՈՐԾԱՐՔ ՉԿԱ է տալիս, երբ confidence-ը ${SIGNAL_THRESHOLDS.minConfidence}-ից ցածր է, երբ աճային և անկումային signal-ները խառն են, երբ momentum-ը հակասում է trend-ին կամ ավելի բարձր ժամանակաշրջանին, երբ RSI-ն ծայրահեղ է, կամ երբ risk/reward-ը ${RISK_RULES.minRiskReward}-ից ցածր է։`,
  },
  {
    title: "AI-ի դերը",
    body: "AI-ն indicator չի հաշվարկում և չի կարող փոխել ուղղությունը, confidence-ը, entry-ն, stop loss-ը կամ take profit-ը։ Միայն բացատրում է արդյունքը պարզ լեզվով։ Ելքը ստուգվում է հորինված թվերի և արգելված պնդումների համար. եթե չի անցնում, ցուցադրվում է կանոնների վրա հիմնված բացատրություն։",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Crypto AI Analyst-ի մասին</h1>
      {SECTIONS.map((section) => (
        <Card key={section.title} className="flex flex-col gap-2 p-6">
          <h2 className="font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-muted">{section.body}</p>
        </Card>
      ))}
      <Card className="border-caution/30 p-6">
        <p className="leading-relaxed text-caution">{DISCLAIMER}</p>
      </Card>
    </div>
  );
}

