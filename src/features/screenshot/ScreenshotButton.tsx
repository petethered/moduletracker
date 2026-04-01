import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import { getLocalDateString } from "../../utils/formatDate";
import { buildScreenshotData } from "./screenshotData";
import { generateScreenshotImage } from "./generateScreenshot";

export function ScreenshotButton() {
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScreenshot = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = buildScreenshotData(pulls, moduleProgress);
      const blob = await generateScreenshotImage(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `module-tracker-screenshot-${getLocalDateString()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate screenshot");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Button
        variant="secondary"
        onClick={handleScreenshot}
        disabled={generating}
        className="w-full"
      >
        {generating ? "Generating..." : "Export Screenshot"}
      </Button>
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
}
