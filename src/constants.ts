export const reloadPath = "/__mdhm_events";

export function getDevReloadScript(): string {
  return `<script>
new EventSource("${reloadPath}").addEventListener("reload", () => location.reload());
</script>`;
}
