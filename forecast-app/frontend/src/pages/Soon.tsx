import { Card, PageTitle } from "../ui";

// Honest placeholder for views being wired in the next pass — names exactly what it will show and
// where its data comes from (no silent "pending").
export default function Soon({ title, desc, endpoint }: { title: string; desc: string; endpoint: string }) {
  return (
    <div className="space-y-4">
      <PageTitle title={title} subtitle="This visualizer is being wired in the next build pass." />
      <Card title="What this will show">
        <p className="text-sm text-foreground">{desc}</p>
        <p className="text-xs text-muted-foreground mt-2">Backend ready · source: <span className="mono">{endpoint}</span></p>
      </Card>
    </div>
  );
}
