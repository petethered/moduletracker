/**
 * ScreenshotButton — UI entry point for generating + downloading the stats screenshot.
 *
 * Role in the broader feature:
 *   The user-facing trigger that wires everything together:
 *     pulls + moduleProgress (store)
 *       → buildScreenshotData (aggregation; screenshotData.ts)
 *       → generateScreenshotImage (canvas paint; generateScreenshot.ts)
 *       → Blob → ObjectURL → <a download> click → cleanup
 *
 *   Lives inside SettingsPanel under "Data Management".
 *
 * User flow:
 *   click → button shows "Generating..." while async work runs → triggers a browser
 *   download via a programmatic anchor click → button returns to default label.
 *
 * Error handling:
 *   Any throw from buildScreenshotData / generateScreenshotImage / toBlob shows a
 *   generic error message. We don't expose internals; the user can retry.
 *
 * Why a programmatic anchor click instead of e.g. file-saver lib:
 *   Standard, dependency-free, and works in every modern browser. The hidden anchor
 *   approach is the canonical way to download a Blob.
 *
 * Gotchas:
 *   - URL.revokeObjectURL is called immediately after click. The browser has already
 *     started the download by then so revoking is safe; if you delay revocation the
 *     URL leaks until page unload.
 *   - Filename includes the local date so screenshots taken on different days don't
 *     collide in the user's Downloads folder.
 */
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import { getLocalDateString } from "../../utils/formatDate";
import { buildScreenshotData } from "./screenshotData";
import { generateScreenshotImage } from "./generateScreenshot";

export function ScreenshotButton() {
  // Source data from the store. We re-aggregate on every click rather than memoizing —
  // generation is fast enough (~tens of ms) and avoids stale derived state.
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  // Disables the button + swaps its label while async work is in flight.
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScreenshot = async () => {
    setGenerating(true);
    setError(null);
    try {
      // 1. Aggregate (sync, fast)
      const data = buildScreenshotData(pulls, moduleProgress);
      // 2. Paint canvas → PNG Blob (async; awaits font load + toBlob)
      const blob = await generateScreenshotImage(data);
      // 3. Blob → ObjectURL → anchor click for download. The anchor never gets
      //    appended to the DOM — modern browsers honor click() on detached anchors.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `module-tracker-screenshot-${getLocalDateString()}.png`;
      a.click();
      // Free the ObjectURL — the browser has already initiated the download from it.
      URL.revokeObjectURL(url);
    } catch {
      // Generic message; we don't surface internals to users.
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
