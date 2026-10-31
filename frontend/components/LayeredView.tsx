import { buildLayeredSvg } from "@/lib/layered";
import type { LayeredDiagram } from "@/lib/types";

/** Shows a layered diagram. The SVG is built from validated data, so the markup is safe to inline. */
export function LayeredView({ turn }: { turn: LayeredDiagram }) {
  return <div className="layered-output" dangerouslySetInnerHTML={{ __html: buildLayeredSvg(turn) }} />;
}
