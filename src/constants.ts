export const reloadPath = "/__mdht_events";

export function getDevReloadScript(): string {
  return `<script>
new EventSource("${reloadPath}").addEventListener("reload", () => location.reload());
</script>`;
}
