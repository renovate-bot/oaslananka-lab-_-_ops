import { json } from "../errors";

const REPOSITORIES = [
  { source: "oaslananka/boardguard", mirror: "oaslananka-lab/boardguard" },
  { source: "oaslananka/kicad-studio", mirror: "oaslananka-lab/kicad-studio" },
  { source: "oaslananka/mcp-health-monitor", mirror: "oaslananka-lab/mcp-health-monitor" },
  { source: "oaslananka/mcp-debug-recorder", mirror: "oaslananka-lab/mcp-debug-recorder" },
  { source: "oaslananka/mcp-infra-lens", mirror: "oaslananka-lab/mcp-infra-lens" },
  { source: "oaslananka/test", mirror: "oaslananka-lab/test" }
];

export function repos(): Response {
  return json({
    repositories: REPOSITORIES
  });
}
