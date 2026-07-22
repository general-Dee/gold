import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { uploadTradeImageAction } from "@/server/actions/images";
import { getTradeById } from "@/server/queries/trades";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTradeById(id);
  if (!result) notFound();
  const { trade, checks, images } = result;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight capitalize">
            {trade.direction} {trade.instrument}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(trade.entryAt).toLocaleString()}
          </p>
        </div>
        <Link href={`/trades/${trade.id}/edit`} className={buttonVariants({ variant: "outline" })}>
          Edit
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Entry price" value={trade.entryPrice} />
          <Field label="Stop loss" value={trade.stopLoss} />
          <Field label="Take profit" value={trade.takeProfit} />
          <Field label="Exit price" value={trade.exitPrice} />
          <Field label="Position size" value={trade.positionSize} />
          <Field
            label="Planned R:R"
            value={trade.riskRewardPlanned != null ? `${trade.riskRewardPlanned.toFixed(2)}R` : null}
          />
          <Field
            label="Realized R:R"
            value={
              trade.riskRewardRealized != null ? `${trade.riskRewardRealized.toFixed(2)}R` : null
            }
          />
          <Field
            label="Outcome"
            value={
              trade.outcome ? (
                <Badge variant={trade.outcome === "win" ? "default" : "secondary"}>
                  {trade.outcome}
                </Badge>
              ) : null
            }
          />
          <Field label="P&L" value={trade.pnl} />
          <Field label="Session" value={trade.session} />
          <Field label="DXY bias" value={trade.dxyBias} />
          <Field label="News nearby" value={trade.newsNearby ? trade.newsNote || "Yes" : "No"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule checklist</CardTitle>
        </CardHeader>
        <CardContent>
          {checks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist recorded for this trade.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.ruleTextSnapshot}</span>
                  <Badge
                    variant={
                      c.status === "followed"
                        ? "default"
                        : c.status === "not_followed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {c.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(trade.reasoning || trade.notesAfter) && (
        <Card>
          <CardHeader>
            <CardTitle>Reasoning &amp; reflection</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {trade.reasoning && (
              <div>
                <div className="text-xs text-muted-foreground">Pre-trade thesis</div>
                <p className="text-sm whitespace-pre-wrap">{trade.reasoning}</p>
              </div>
            )}
            {trade.notesAfter && (
              <div>
                <div className="text-xs text-muted-foreground">Post-trade reflection</div>
                <p className="text-sm whitespace-pre-wrap">{trade.notesAfter}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chart images</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <a key={img.id} href={`/api/uploads/${img.filePath}`} target="_blank">
                  <Image
                    src={`/api/uploads/${img.filePath}`}
                    alt={img.caption ?? "Trade chart"}
                    width={300}
                    height={200}
                    className="h-32 w-full rounded-md border object-cover"
                    unoptimized
                  />
                </a>
              ))}
            </div>
          )}
          <form
            action={uploadTradeImageAction.bind(null, trade.id)}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Input type="file" name="file" accept="image/*" required />
            </div>
            <Button type="submit" variant="outline">
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
